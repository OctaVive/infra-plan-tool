import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LineType(str, enum.Enum):
    ONNET = "onnet"
    OFFNET = "offnet"
    SPECIAL = "special"


class OrderStatus(str, enum.Enum):
    OPEN = "open"
    COMPLETED = "completed"


LINE_TYPE_MAP = {
    "onnet": LineType.ONNET,
    "offnet": LineType.OFFNET,
    "nearnet": LineType.OFFNET,
    "special": LineType.SPECIAL,
}


def parse_line_type(value: str) -> LineType | None:
    if not value:
        return None
    return LINE_TYPE_MAP.get(value.strip().lower())


class ReportUpload(Base):
    __tablename__ = "report_uploads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    report_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    filename: Mapped[str] = mapped_column(String(512))
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    orders_imported: Mapped[int] = mapped_column(Integer, default=0)
    changes_detected: Mapped[int] = mapped_column(Integer, default=0)
    sla_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    is_first_upload: Mapped[bool] = mapped_column(Boolean, default=False)
    warnings: Mapped[str | None] = mapped_column(Text, nullable=True)

    changes: Mapped[list["OrderChange"]] = relationship(back_populates="report_upload")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_number: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    bedrijf: Mapped[str] = mapped_column(String(512), index=True)
    geplaatst_op: Mapped[date] = mapped_column(Date)
    gepland: Mapped[date] = mapped_column(Date)
    line_type: Mapped[LineType] = mapped_column(Enum(LineType))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.OPEN)
    last_report_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("report_uploads.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class OrderChange(Base):
    __tablename__ = "order_changes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    report_upload_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("report_uploads.id"), index=True)
    order_number: Mapped[str] = mapped_column(String(128), index=True)
    bedrijf: Mapped[str] = mapped_column(String(512), index=True)
    line_type: Mapped[LineType] = mapped_column(Enum(LineType))
    geplaatst_op: Mapped[date] = mapped_column(Date)
    previous_gepland: Mapped[date | None] = mapped_column(Date, nullable=True)
    new_gepland: Mapped[date] = mapped_column(Date)
    sla_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    days_shifted: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_date_moved_later: Mapped[bool] = mapped_column(Boolean, default=False)
    is_sla_risk: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new_order: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    report_upload: Mapped["ReportUpload"] = relationship(back_populates="changes")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
