import logging
from pathlib import PurePath

from app.services.excel_parser import parse_excel_xlsx
from app.services.report_types import ALLOWED_EXTENSIONS, ParseResult
from app.services.xml_parser import parse_excel_xml

logger = logging.getLogger(__name__)


def detect_format(content: bytes, filename: str | None) -> str:
    ext = PurePath(filename or "").suffix.lower()
    if ext in {".xlsx", ".xlsm"}:
        return "xlsx"
    if ext == ".xml":
        return "xml"

    stripped = content.lstrip()
    if content[:2] == b"PK":
        return "xlsx"
    if stripped.startswith(b"<?xml") or stripped.startswith(b"<"):
        return "xml"

    raise ValueError(
        f"Bestandsformaat niet herkend. Ondersteunde formaten: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
    )


def parse_report(content: bytes, filename: str | None = None) -> ParseResult:
    fmt = detect_format(content, filename)
    logger.info("Parsing report as %s (%s)", fmt, filename or "unknown")
    if fmt == "xlsx":
        return parse_excel_xlsx(content)
    return parse_excel_xml(content)
