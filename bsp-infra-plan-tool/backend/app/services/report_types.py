import hashlib
from dataclasses import dataclass, field
from datetime import date, datetime

REQUIRED_COLUMNS = {
    "Order number",
    "Bedrijf",
    "Geplaatst op",
    "Gepland",
    "On-/Offnet",
    "Order type",
}

ORDER_TYPE_COLUMN = "Order type"
ALLOWED_ORDER_TYPE = "nieuw"

ALLOWED_EXTENSIONS = {".xml", ".xlsx", ".xlsm"}


@dataclass
class ParsedOrder:
    order_number: str
    bedrijf: str
    geplaatst_op: date
    gepland: date
    line_type: str


@dataclass
class ParseResult:
    orders: list[ParsedOrder] = field(default_factory=list)
    report_date: datetime | None = None
    warnings: list[str] = field(default_factory=list)
    skipped_rows: int = 0
    filtered_order_type: int = 0


def file_content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def parse_date_value(value: str | date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    for fmt, size in (
        ("%Y-%m-%dT%H:%M:%S.%f", 26),
        ("%Y-%m-%dT%H:%M:%S", 19),
        ("%Y-%m-%d %H:%M:%S", 19),
        ("%Y-%m-%d", 10),
    ):
        try:
            return datetime.strptime(text[:size], fmt).date()
        except ValueError:
            continue
    return None


def parse_datetime_value(value: str | date | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    for fmt, size in (
        ("%Y-%m-%d %H:%M:%S", 19),
        ("%Y-%m-%dT%H:%M:%S", 19),
        ("%Y-%m-%d", 10),
    ):
        try:
            return datetime.strptime(text[:size], fmt)
        except ValueError:
            continue
    parsed = parse_date_value(text)
    if parsed:
        return datetime.combine(parsed, datetime.min.time())
    return None


def cell_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_allowed_order_type(value: str) -> bool:
    return cell_text(value).lower() == ALLOWED_ORDER_TYPE


def finalize_parse_result(result: ParseResult) -> ParseResult:
    if result.filtered_order_type > 0:
        result.warnings.append(
            f"{result.filtered_order_type} rij(en) overgeslagen: alleen Order type 'Nieuw' wordt geïmporteerd"
        )
    if not result.orders and (result.skipped_rows > 0 or result.filtered_order_type > 0):
        result.warnings.append("Geen geldige orders geïmporteerd")
    return result
