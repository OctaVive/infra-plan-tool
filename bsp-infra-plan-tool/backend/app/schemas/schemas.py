from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SlaSettingsUpdate(BaseModel):
    onnet: int = Field(ge=1, le=999)
    offnet: int = Field(ge=1, le=999)
    special: int = Field(ge=1, le=999)


class RetentionSettingsUpdate(BaseModel):
    retention_days: int = Field(ge=30, le=3650)


class SettingsResponse(BaseModel):
    sla_days: dict[str, int]
    sla_configured: bool
    retention_days: int


class ClearDataRequest(BaseModel):
    confirm: bool = Field(description="Must be true to confirm data deletion")


class ClearDataResponse(BaseModel):
    changes_deleted: int
    orders_deleted: int
    uploads_deleted: int
    message: str


class ReportUploadResponse(BaseModel):
    id: UUID
    uploaded_at: datetime
    report_date: datetime | None
    filename: str
    orders_imported: int
    changes_detected: int
    sla_risk_count: int
    is_first_upload: bool
    warnings: str | None

    model_config = {"from_attributes": True}


class OrderDetail(BaseModel):
    order_number: str
    line_type: str
    geplaatst_op: date
    previous_gepland: date | None
    new_gepland: date
    sla_deadline: date | None
    days_shifted: int | None
    is_sla_risk: bool
    is_new_order: bool


class CustomerCard(BaseModel):
    bedrijf: str
    has_change: bool
    has_sla_risk: bool
    order_count: int
    orders: list[OrderDetail]


class DashboardResponse(BaseModel):
    last_upload: ReportUploadResponse | None
    customers: list[CustomerCard]


class KpiResponse(BaseModel):
    sla_risk_count: int
    changes_detected: int
    orders_imported: int
    last_upload_at: datetime | None


class OrderChangeResponse(BaseModel):
    id: UUID
    report_upload_id: UUID
    order_number: str
    bedrijf: str
    line_type: str
    geplaatst_op: date
    previous_gepland: date | None
    new_gepland: date
    sla_deadline: date | None
    days_shifted: int | None
    is_date_moved_later: bool
    is_sla_risk: bool
    is_new_order: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedChanges(BaseModel):
    items: list[OrderChangeResponse]
    total: int
    page: int
    page_size: int
    pages: int
