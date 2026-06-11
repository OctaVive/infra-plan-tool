import logging

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Order, OrderChange, ReportUpload

logger = logging.getLogger(__name__)


async def clear_all_data(session: AsyncSession) -> dict[str, int]:
    """Remove all orders, changes and uploads. App settings (SLA, retention) are preserved."""
    changes_count = await session.scalar(select(func.count()).select_from(OrderChange)) or 0
    orders_count = await session.scalar(select(func.count()).select_from(Order)) or 0
    uploads_count = await session.scalar(select(func.count()).select_from(ReportUpload)) or 0

    await session.execute(delete(OrderChange))
    await session.execute(delete(Order))
    await session.execute(delete(ReportUpload))
    await session.commit()

    logger.warning(
        "All application data cleared: %d changes, %d orders, %d uploads",
        changes_count,
        orders_count,
        uploads_count,
    )

    return {
        "changes_deleted": changes_count,
        "orders_deleted": orders_count,
        "uploads_deleted": uploads_count,
    }
