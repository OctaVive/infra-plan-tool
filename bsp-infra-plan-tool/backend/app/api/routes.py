import csv
import io
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import LineType, OrderChange, ReportUpload
from app.schemas.schemas import (
    ClearDataRequest,
    ClearDataResponse,
    CustomerCard,
    DashboardResponse,
    KpiResponse,
    OrderDetail,
    PaginatedChanges,
    OrderChangeResponse,
    ReportUploadResponse,
    RetentionSettingsUpdate,
    SettingsResponse,
    SlaSettingsUpdate,
)
from app.services.data_service import clear_all_data
from app.services.report_service import DuplicateReportError, process_report_upload
from app.services.settings_service import (
    get_retention_days,
    get_sla_days,
    set_retention_days,
    set_sla_days,
    sla_configured,
)
from app.services.report_parser import parse_report
from app.services.report_types import ALLOWED_EXTENSIONS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


@router.post("/reports/upload", response_model=ReportUploadResponse)
async def upload_report(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Bestandsnaam ontbreekt")

    ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""
    if f".{ext}" not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Alleen {allowed} bestanden zijn toegestaan")

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Bestand te groot (max {settings.max_upload_size_mb} MB)")

    try:
        parse_result = parse_report(content, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        upload = await process_report_upload(db, content, file.filename, parse_result)
    except DuplicateReportError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return upload


@router.get("/reports/latest", response_model=ReportUploadResponse | None)
async def get_latest_report(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReportUpload).order_by(ReportUpload.uploaded_at.desc()).limit(1)
    )
    upload = result.scalar_one_or_none()
    return upload


async def _get_latest_upload(db: AsyncSession) -> ReportUpload | None:
    result = await db.execute(
        select(ReportUpload).order_by(ReportUpload.uploaded_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    latest = await _get_latest_upload(db)
    if not latest:
        return DashboardResponse(last_upload=None, customers=[])

    result = await db.execute(
        select(OrderChange).where(OrderChange.report_upload_id == latest.id)
    )
    changes = result.scalars().all()

    if latest.is_first_upload:
        relevant = [c for c in changes if c.is_new_order]
    else:
        relevant = [c for c in changes if c.is_date_moved_later]

    by_bedrijf: dict[str, list[OrderChange]] = {}
    for change in relevant:
        by_bedrijf.setdefault(change.bedrijf, []).append(change)

    customers: list[CustomerCard] = []
    for bedrijf, bedrijf_changes in sorted(by_bedrijf.items()):
        has_sla_risk = any(c.is_sla_risk for c in bedrijf_changes)
        orders = [
            OrderDetail(
                order_number=c.order_number,
                line_type=c.line_type.value,
                geplaatst_op=c.geplaatst_op,
                previous_gepland=c.previous_gepland,
                new_gepland=c.new_gepland,
                sla_deadline=c.sla_deadline,
                days_shifted=c.days_shifted,
                is_sla_risk=c.is_sla_risk,
                is_new_order=c.is_new_order,
            )
            for c in bedrijf_changes
        ]
        customers.append(
            CustomerCard(
                bedrijf=bedrijf,
                has_change=True,
                has_sla_risk=has_sla_risk,
                order_count=len(orders),
                orders=orders,
            )
        )

    customers.sort(key=lambda c: (not c.has_sla_risk, c.bedrijf))

    return DashboardResponse(
        last_upload=ReportUploadResponse.model_validate(latest),
        customers=customers,
    )


@router.get("/dashboard/kpi", response_model=KpiResponse)
async def get_kpi(db: AsyncSession = Depends(get_db)):
    latest = await _get_latest_upload(db)
    if not latest:
        return KpiResponse(
            sla_risk_count=0,
            changes_detected=0,
            orders_imported=0,
            last_upload_at=None,
        )
    return KpiResponse(
        sla_risk_count=latest.sla_risk_count,
        changes_detected=latest.changes_detected,
        orders_imported=latest.orders_imported,
        last_upload_at=latest.uploaded_at,
    )


def _apply_change_filters(query, **filters):
    q = query
    if filters.get("bedrijf"):
        q = q.where(OrderChange.bedrijf.ilike(f"%{filters['bedrijf']}%"))
    if filters.get("line_type"):
        try:
            lt = LineType(filters["line_type"])
            q = q.where(OrderChange.line_type == lt)
        except ValueError:
            pass
    if filters.get("is_sla_risk") is not None:
        q = q.where(OrderChange.is_sla_risk == filters["is_sla_risk"])
    if filters.get("date_from"):
        q = q.where(OrderChange.created_at >= filters["date_from"])
    if filters.get("date_to"):
        q = q.where(OrderChange.created_at <= filters["date_to"])
    if filters.get("search"):
        term = f"%{filters['search']}%"
        q = q.where(
            (OrderChange.order_number.ilike(term)) | (OrderChange.bedrijf.ilike(term))
        )
    return q


@router.get("/changes", response_model=PaginatedChanges)
async def list_changes(
    bedrijf: str | None = None,
    line_type: str | None = None,
    is_sla_risk: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = {
        "bedrijf": bedrijf,
        "line_type": line_type,
        "is_sla_risk": is_sla_risk,
        "date_from": date_from,
        "date_to": date_to,
        "search": search,
    }
    base = select(OrderChange)
    filtered = _apply_change_filters(base, **filters)

    count_result = await db.execute(select(func.count()).select_from(filtered.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        filtered.order_by(OrderChange.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()
    pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedChanges(
        items=[OrderChangeResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/changes/export")
async def export_changes(
    bedrijf: str | None = None,
    line_type: str | None = None,
    is_sla_risk: bool | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import StreamingResponse

    filters = {"bedrijf": bedrijf, "line_type": line_type, "is_sla_risk": is_sla_risk, "search": search}
    query = _apply_change_filters(select(OrderChange), **filters).order_by(OrderChange.created_at.desc())
    result = await db.execute(query)
    changes = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "order_number", "bedrijf", "line_type", "geplaatst_op",
        "previous_gepland", "new_gepland", "sla_deadline", "days_shifted",
        "is_sla_risk", "is_new_order", "created_at",
    ])
    for c in changes:
        writer.writerow([
            c.order_number, c.bedrijf, c.line_type.value, c.geplaatst_op.isoformat(),
            c.previous_gepland.isoformat() if c.previous_gepland else "",
            c.new_gepland.isoformat(), c.sla_deadline.isoformat() if c.sla_deadline else "",
            c.days_shifted or "", c.is_sla_risk, c.is_new_order, c.created_at.isoformat(),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=order_changes.csv"},
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    sla = await get_sla_days(db)
    retention = await get_retention_days(db)
    return SettingsResponse(
        sla_days=sla,
        sla_configured=sla_configured(sla),
        retention_days=retention,
    )


@router.put("/settings/sla", response_model=SettingsResponse)
async def update_sla(data: SlaSettingsUpdate, db: AsyncSession = Depends(get_db)):
    sla = {"onnet": data.onnet, "offnet": data.offnet, "special": data.special}
    await set_sla_days(db, sla)
    await db.commit()
    retention = await get_retention_days(db)
    return SettingsResponse(sla_days=sla, sla_configured=True, retention_days=retention)


@router.put("/settings/retention", response_model=SettingsResponse)
async def update_retention(data: RetentionSettingsUpdate, db: AsyncSession = Depends(get_db)):
    await set_retention_days(db, data.retention_days)
    await db.commit()
    sla = await get_sla_days(db)
    retention = await get_retention_days(db)
    return SettingsResponse(
        sla_days=sla,
        sla_configured=sla_configured(sla),
        retention_days=retention,
    )


@router.post("/admin/clear-data", response_model=ClearDataResponse)
async def clear_data(data: ClearDataRequest, db: AsyncSession = Depends(get_db)):
    if not data.confirm:
        raise HTTPException(
            status_code=400,
            detail="Bevestiging vereist: stel confirm op true in",
        )
    result = await clear_all_data(db)
    return ClearDataResponse(
        **result,
        message="Alle orders, uploads en wijzigingsgeschiedenis zijn verwijderd. SLA-instellingen zijn behouden.",
    )
