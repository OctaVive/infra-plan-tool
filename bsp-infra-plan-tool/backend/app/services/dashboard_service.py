import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import LineType, Order, OrderChange, OrderStatus, ReportUpload
from app.schemas.schemas import CustomerCard, DashboardResponse, KpiResponse, OrderDetail, ReportUploadResponse
from app.services.settings_service import get_sla_days, sla_configured
from app.services.sla import calculate_sla_deadline, is_sla_risk, sla_business_days_over

logger = logging.getLogger(__name__)


async def _get_latest_upload(session: AsyncSession) -> ReportUpload | None:
    result = await session.execute(
        select(ReportUpload).order_by(ReportUpload.uploaded_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_open_orders(session: AsyncSession) -> list[Order]:
    result = await session.execute(
        select(Order).where(Order.status == OrderStatus.OPEN).order_by(Order.bedrijf, Order.order_number)
    )
    return list(result.scalars().all())


async def _get_latest_changes(session: AsyncSession, upload_id) -> dict[str, OrderChange]:
    result = await session.execute(
        select(OrderChange).where(OrderChange.report_upload_id == upload_id)
    )
    return {c.order_number: c for c in result.scalars().all()}


def _order_sla_state(
    order: Order, sla_days: dict[str, int], sla_ready: bool
) -> tuple[date | None, bool, int]:
    if not sla_ready:
        return None, False, 0
    days = sla_days.get(order.line_type.value, 0)
    deadline = calculate_sla_deadline(order.geplaatst_op, days)
    at_risk = is_sla_risk(order.gepland, deadline)
    days_over = sla_business_days_over(deadline, order.gepland) if at_risk else 0
    return deadline, at_risk, days_over


def _is_relevant_change(change: OrderChange | None, is_first_upload: bool) -> bool:
    if change is None:
        return False
    if is_first_upload:
        return change.is_new_order
    return change.is_date_moved_later


async def compute_kpi(session: AsyncSession) -> KpiResponse:
    latest = await _get_latest_upload(session)
    if not latest:
        return KpiResponse(
            sla_risk_count=0,
            changes_detected=0,
            orders_imported=0,
            last_upload_at=None,
        )

    sla_days = await get_sla_days(session)
    sla_ready = sla_configured(sla_days)
    open_orders = await _get_open_orders(session)

    sla_risk_count = 0
    for order in open_orders:
        _, at_risk, _ = _order_sla_state(order, sla_days, sla_ready)
        if at_risk:
            sla_risk_count += 1

    return KpiResponse(
        sla_risk_count=sla_risk_count,
        changes_detected=latest.changes_detected,
        orders_imported=latest.orders_imported,
        last_upload_at=latest.uploaded_at,
    )


async def build_dashboard(session: AsyncSession) -> DashboardResponse:
    latest = await _get_latest_upload(session)
    if not latest:
        return DashboardResponse(last_upload=None, customers=[])

    sla_days = await get_sla_days(session)
    sla_ready = sla_configured(sla_days)
    open_orders = await _get_open_orders(session)
    latest_changes = await _get_latest_changes(session, latest.id)

    by_bedrijf: dict[str, list[OrderDetail]] = {}

    for order in open_orders:
        deadline, at_risk, days_over = _order_sla_state(order, sla_days, sla_ready)
        change = latest_changes.get(order.order_number)
        has_recent_change = _is_relevant_change(change, latest.is_first_upload)

        if latest.is_first_upload:
            if not change or not change.is_new_order:
                continue
        elif not has_recent_change and not at_risk:
            continue

        previous_gepland = change.previous_gepland if change else None
        days_shifted = change.days_shifted if change else None

        detail = OrderDetail(
            order_number=order.order_number,
            line_type=order.line_type.value,
            geplaatst_op=order.geplaatst_op,
            previous_gepland=previous_gepland,
            new_gepland=order.gepland,
            sla_deadline=deadline,
            days_shifted=days_shifted,
            sla_days_over=days_over if at_risk else None,
            is_sla_risk=at_risk,
            is_new_order=change.is_new_order if change else False,
        )
        by_bedrijf.setdefault(order.bedrijf, []).append(detail)

    customers: list[CustomerCard] = []
    for bedrijf, orders in sorted(by_bedrijf.items()):
        has_sla_risk = any(o.is_sla_risk for o in orders)
        has_change = any(o.is_new_order or o.days_shifted is not None for o in orders)
        customers.append(
            CustomerCard(
                bedrijf=bedrijf,
                has_change=has_change or latest.is_first_upload,
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
