import pytest
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook

from app.models.models import parse_line_type
from app.services.excel_parser import parse_excel_xlsx
from app.services.report_parser import detect_format, parse_report
from app.services.report_types import is_allowed_order_type
from app.services.xml_parser import parse_excel_xml

MINIMAL_XML = b"""<?xml version='1.0' encoding='utf-8'?>
<ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <ss:Worksheet ss:Name="Info">
  <ss:Table>
   <ss:Row>
    <ss:Cell><ss:Data ss:Type="String">Aangemaakt op</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">2026-06-11 10:18:45</ss:Data></ss:Cell>
   </ss:Row>
  </ss:Table>
 </ss:Worksheet>
 <ss:Worksheet ss:Name="Lijn orders">
  <ss:Table>
   <ss:Row>
    <ss:Cell><ss:Data ss:Type="String">Bedrijf</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Order number</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Geplaatst op</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Gepland</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">On-/Offnet</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Order type</ss:Data></ss:Cell>
   </ss:Row>
   <ss:Row>
    <ss:Cell><ss:Data ss:Type="String">Test BV</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">VF-2025-L001</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="DateTime">2026-01-15T00:00:00.000</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="DateTime">2026-06-30T00:00:00.000</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Onnet</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Nieuw</ss:Data></ss:Cell>
   </ss:Row>
   <ss:Row>
    <ss:Cell><ss:Data ss:Type="String">Test BV 2</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">VF-2025-L002</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="DateTime">2026-01-15T00:00:00.000</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="DateTime">2026-06-30T00:00:00.000</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Onnet</ss:Data></ss:Cell>
    <ss:Cell><ss:Data ss:Type="String">Opzegging</ss:Data></ss:Cell>
   </ss:Row>
  </ss:Table>
 </ss:Worksheet>
</ss:Workbook>"""


def _build_minimal_xlsx() -> bytes:
    wb = Workbook()
    info = wb.active
    info.title = "Info"
    info.append(["Aangemaakt op", datetime(2026, 6, 11, 10, 18, 45)])
    ws = wb.create_sheet("Lijn orders")
    ws.append(["Bedrijf", "Order number", "Geplaatst op", "Gepland", "On-/Offnet", "Order type"])
    ws.append(["Test BV", "VF-2025-L001", datetime(2026, 1, 15), datetime(2026, 6, 30), "Onnet", "Nieuw"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_line_type():
    assert parse_line_type("Onnet").value == "onnet"
    assert parse_line_type("Offnet").value == "offnet"
    assert parse_line_type("Special").value == "special"
    assert parse_line_type("") is None


def test_is_allowed_order_type():
    assert is_allowed_order_type("Nieuw") is True
    assert is_allowed_order_type("nieuw") is True
    assert is_allowed_order_type("Opzegging") is False
    assert is_allowed_order_type("Wijziging") is False
    assert is_allowed_order_type("Retention") is False


def test_parse_minimal_xml():
    result = parse_excel_xml(MINIMAL_XML)
    assert len(result.orders) == 1
    assert result.orders[0].order_number == "VF-2025-L001"
    assert result.filtered_order_type == 1


def test_parse_minimal_xlsx():
    content = _build_minimal_xlsx()
    result = parse_excel_xlsx(content)
    assert len(result.orders) == 1
    assert result.orders[0].order_number == "VF-2025-L001"
    assert result.report_date is not None


def test_parse_report_dispatches_by_extension():
    xlsx = _build_minimal_xlsx()
    assert detect_format(xlsx, "report.xlsx") == "xlsx"
    assert detect_format(MINIMAL_XML, "report.xml") == "xml"
    assert parse_report(xlsx, "report.xlsx").orders[0].order_number == "VF-2025-L001"
    assert parse_report(MINIMAL_XML, "report.xml").orders[0].order_number == "VF-2025-L001"


def test_missing_sheet_raises():
    bad = b"""<?xml version='1.0'?><ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"></ss:Workbook>"""
    with pytest.raises(ValueError, match="Lijn orders"):
        parse_excel_xml(bad)
