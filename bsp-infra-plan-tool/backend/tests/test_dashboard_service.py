from datetime import date

import pytest

from app.models.models import LineType
from app.services.dashboard_service import _is_relevant_change
from app.services.sla import calculate_sla_deadline, is_sla_risk


class FakeChange:
    def __init__(self, is_new_order=False, is_date_moved_later=False):
        self.is_new_order = is_new_order
        self.is_date_moved_later = is_date_moved_later


def test_is_relevant_change_first_upload():
    assert _is_relevant_change(FakeChange(is_new_order=True), True) is True
    assert _is_relevant_change(FakeChange(is_new_order=False), True) is False


def test_is_relevant_change_subsequent():
    assert _is_relevant_change(FakeChange(is_date_moved_later=True), False) is True
    assert _is_relevant_change(FakeChange(is_new_order=True), False) is False


def test_current_sla_risk_persists_without_change():
    geplaatst = date(2025, 1, 2)
    gepland = date(2026, 12, 31)
    deadline = calculate_sla_deadline(geplaatst, 30)
    assert is_sla_risk(gepland, deadline) is True
