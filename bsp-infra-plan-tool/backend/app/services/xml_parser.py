import logging
import xml.etree.ElementTree as ET

from app.models.models import parse_line_type
from app.services.report_types import (
    REQUIRED_COLUMNS,
    ParseResult,
    ParsedOrder,
    cell_text,
    finalize_parse_result,
    is_allowed_order_type,
    parse_date_value,
    parse_datetime_value,
)

logger = logging.getLogger(__name__)

NS = {"ss": "urn:schemas-microsoft-com:office:spreadsheet"}


def _row_cells(row: ET.Element) -> dict[int, str]:
    cells: dict[int, str] = {}
    col = 1
    for cell in row.findall("ss:Cell", NS):
        index_attr = cell.get(f"{{{NS['ss']}}}Index")
        if index_attr:
            col = int(index_attr)
        data = cell.find("ss:Data", NS)
        cells[col] = data.text.strip() if data is not None and data.text else ""
        col += 1
    return cells


def _find_worksheet(root: ET.Element, name: str) -> ET.Element | None:
    for ws in root.findall(".//ss:Worksheet", NS):
        if ws.get(f"{{{NS['ss']}}}Name") == name:
            return ws
    return None


def _parse_info_report_date(root: ET.Element):
    ws = _find_worksheet(root, "Info")
    if ws is None:
        return None
    table = ws.find("ss:Table", NS)
    if table is None:
        return None
    for row in table.findall("ss:Row", NS):
        cells = _row_cells(row)
        values = [cells.get(i, "") for i in sorted(cells.keys())]
        if len(values) >= 2 and values[0] == "Aangemaakt op":
            return parse_datetime_value(values[1])
    return None


def parse_excel_xml(content: bytes) -> ParseResult:
    result = ParseResult()
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError(f"Ongeldig XML-bestand: {exc}") from exc

    result.report_date = _parse_info_report_date(root)

    ws = _find_worksheet(root, "Lijn orders")
    if ws is None:
        raise ValueError("Tabblad 'Lijn orders' niet gevonden in het bestand")

    table = ws.find("ss:Table", NS)
    if table is None:
        raise ValueError("Geen tabel gevonden op tabblad 'Lijn orders'")

    rows = table.findall("ss:Row", NS)
    if not rows:
        raise ValueError("Tabblad 'Lijn orders' bevat geen rijen")

    header_cells = _row_cells(rows[0])
    column_map: dict[str, int] = {name: idx for idx, name in header_cells.items()}

    missing = REQUIRED_COLUMNS - set(column_map.keys())
    if missing:
        raise ValueError(f"Ontbrekende kolommen: {', '.join(sorted(missing))}")

    for row_idx, row in enumerate(rows[1:], start=2):
        cells = _row_cells(row)

        def get_col(name: str) -> str:
            idx = column_map.get(name)
            return cells.get(idx, "") if idx else ""

        order_number = get_col("Order number")
        bedrijf = get_col("Bedrijf")
        geplaatst_op = parse_date_value(get_col("Geplaatst op"))
        gepland = parse_date_value(get_col("Gepland"))
        line_type = parse_line_type(get_col("On-/Offnet"))

        if not order_number:
            result.skipped_rows += 1
            continue

        order_type = get_col("Order type")
        if not is_allowed_order_type(order_type):
            result.filtered_order_type += 1
            continue

        if not bedrijf or not geplaatst_op or not gepland or not line_type:
            result.warnings.append(
                f"Rij {row_idx} overgeslagen: ontbrekende verplichte velden voor order {order_number}"
            )
            result.skipped_rows += 1
            continue

        result.orders.append(
            ParsedOrder(
                order_number=order_number,
                bedrijf=bedrijf,
                geplaatst_op=geplaatst_op,
                gepland=gepland,
                line_type=line_type.value,
            )
        )

    logger.info(
        "Parsed %d orders from XML, skipped %d rows, filtered %d by order type",
        len(result.orders),
        result.skipped_rows,
        result.filtered_order_type,
    )
    return finalize_parse_result(result)
