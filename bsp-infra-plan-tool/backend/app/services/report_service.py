import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    LineType,
    Order,
    OrderChange,
    OrderStatus,
    ReportUpload,
)
from app.services.report_types import ParseResult, file_content_hash
from app.services.settings_service import get_sla_days, sla_configured
from app.services.sla import calculate_sla_deadline, is_sla_risk

logger = logging.getLogger(__name__)


class DuplicateReportError(Exception):
    pass


async def _get_existing_hash(session: AsyncSession, content_hash: str) -> ReportUpload | None:
    result = await session.execute(
        select(ReportUpload).where(ReportUpload.content_hash == content_hash)
    )
    return result.scalar_one_or_none()


async def _get_open_orders(session: AsyncSession) -> dict[str, Order]:
    result = await session.execute(select(Order).where(Order.status == OrderStatus.OPEN))
    return {o.order_number: o for o in result.scalars().all()}


async def _count_previous_uploads(session: AsyncSession) -> int:
    result = await session.execute(select(ReportUpload))
    return len(result.scalars().all())


async def process_report_upload(
    session: AsyncSession,
    content: bytes,
    filename: str,
    parse_result: ParseResult,
) -> ReportUpload:
    content_hash = file_content_hash(content)
    existing = await _get_existing_hash(session, content_hash)
    if existing:
        raise DuplicateReportError(
            f"Dit bestand is al geüpload op {existing.uploaded_at.isoformat()}"
        )

    previous_count = await _count_previous_uploads(session)
    is_first = previous_count == 0

    sla_days = await get_sla_days(session)
    sla_ready = sla_configured(sla_days)

    if not sla_ready:
        parse_result.warnings.insert(0, "SLA-dagen zijn nog niet volledig geconfigureerd")

    open_orders = await _get_open_orders(session)
    incoming = {o.order_number: o for o in parse_result.orders}

    upload = ReportUpload(
        uploaded_at=datetime.now(timezone.utc),
        report_date=parse_result.report_date,
        filename=filename,
        content_hash=content_hash,
        is_first_upload=is_first,
        warnings="\n".join(parse_result.warnings) if parse_result.warnings else None,
    )
    session.add(upload)
    await session.flush()

    changes: list[OrderChange] = []
    sla_risk_count = 0

    for parsed in parse_result.orders:
        line_type = LineType(parsed.line_type)
        sla_day_count = sla_days.get(line_type.value, 0)
        deadline = calculate_sla_deadline(parsed.geplaatst_op, sla_day_count) if sla_ready else None

        existing_order = open_orders.get(parsed.order_number)

        if is_first:
            change = OrderChange(
                report_upload_id=upload.id,
                order_number=parsed.order_number,
                bedrijf=parsed.bedrijf,
                line_type=line_type,
                geplaatst_op=parsed.geplaatst_op,
                previous_gepland=None,
                new_gepland=parsed.gepland,
                sla_deadline=deadline,
                days_shifted=None,
                is_date_moved_later=False,
                is_sla_risk=is_sla_risk(parsed.gepland, deadline) if sla_ready else False,
                is_new_order=True,
            )
            changes.append(change)
            if change.is_sla_risk:
                sla_risk_count += 1
        elif existing_order is None:
            pass
        elif parsed.gepland > existing_order.gepland:
            days_shifted = (parsed.gepland - existing_order.gepland).days
            risk = is_sla_risk(parsed.gepland, deadline) if sla_ready else False
            change = OrderChange(
                report_upload_id=upload.id,
                order_number=parsed.order_number,
                bedrijf=parsed.bedrijf,
                line_type=line_type,
                geplaatst_op=parsed.geplaatst_op,
                previous_gepland=existing_order.gepland,
                new_gepland=parsed.gepland,
                sla_deadline=deadline,
                days_shifted=days_shifted,
                is_date_moved_later=True,
                is_sla_risk=risk,
                is_new_order=False,
            )
            changes.append(change)
            if risk:
                sla_risk_count += 1

        order = existing_order or Order(
            order_number=parsed.order_number,
            bedrijf=parsed.bedrijf,
            geplaatst_op=parsed.geplaatst_op,
            gepland=parsed.gepland,
            line_type=line_type,
            status=OrderStatus.OPEN,
        )
        order.bedrijf = parsed.bedrijf
        order.geplaatst_op = parsed.geplaatst_op
        order.gepland = parsed.gepland
        order.line_type = line_type
        order.status = OrderStatus.OPEN
        order.last_report_id = upload.id
        order.updated_at = datetime.now(timezone.utc)
        if existing_order is None:
            session.add(order)

    for order_number, order in open_orders.items():
        if order_number not in incoming:
            order.status = OrderStatus.COMPLETED
            order.updated_at = datetime.now(timezone.utc)

    session.add_all(changes)

    upload.orders_imported = len(parse_result.orders)
    upload.changes_detected = len(changes)
    upload.sla_risk_count = sla_risk_count

    await session.commit()
    await session.refresh(upload)

    logger.info(
        "Processed report %s: %d orders, %d changes, %d SLA risks",
        upload.id,
        upload.orders_imported,
        upload.changes_detected,
        upload.sla_risk_count,
    )
    return upload
