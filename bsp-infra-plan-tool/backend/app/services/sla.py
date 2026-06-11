from datetime import date, timedelta

import holidays


def add_business_days(start: date, business_days: int, country: str = "NL") -> date:
    """Add N business days to start date (start is day 0, deadline is end of Nth business day)."""
    if business_days <= 0:
        return start
    nl_holidays = holidays.country_holidays(country)
    current = start
    counted = 0
    while counted < business_days:
        current += timedelta(days=1)
        if current.weekday() < 5 and current not in nl_holidays:
            counted += 1
    return current


def calculate_sla_deadline(geplaatst_op: date, sla_days: int) -> date | None:
    if sla_days <= 0:
        return None
    return add_business_days(geplaatst_op, sla_days)


def is_sla_risk(new_gepland: date, sla_deadline: date | None) -> bool:
    if sla_deadline is None:
        return False
    return new_gepland > sla_deadline


def sla_business_days_over(
    sla_deadline: date | None,
    gepland: date,
    country: str = "NL",
) -> int:
    """Count business days gepland exceeds the SLA deadline (0 when on time)."""
    if sla_deadline is None or gepland <= sla_deadline:
        return 0
    nl_holidays = holidays.country_holidays(country)
    current = sla_deadline
    counted = 0
    while current < gepland:
        current += timedelta(days=1)
        if current.weekday() < 5 and current not in nl_holidays:
            counted += 1
    return counted
