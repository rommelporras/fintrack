from datetime import date
from app.services.credit_card import (
    get_closed_statement_period,
    get_open_billing_period,
    get_due_date,
    days_until_due,
)


def test_closed_period_after_statement_day():
    # statement_day=15, today=Feb 19 (after close) → last close was Feb 15
    result = get_closed_statement_period(15, reference=date(2026, 2, 19))
    assert result["period_end"] == date(2026, 2, 15)
    assert result["period_start"] == date(2026, 1, 16)


def test_closed_period_before_statement_day():
    # statement_day=25, today=Feb 19 (before close) → last close was Jan 25
    result = get_closed_statement_period(25, reference=date(2026, 2, 19))
    assert result["period_end"] == date(2026, 1, 25)
    assert result["period_start"] == date(2025, 12, 26)


def test_open_period_after_statement_day():
    # statement_day=15, today=Feb 19 → open period is Feb 16 – Mar 15
    result = get_open_billing_period(15, reference=date(2026, 2, 19))
    assert result["period_start"] == date(2026, 2, 16)
    assert result["period_end"] == date(2026, 3, 15)


def test_due_date():
    # statement_day=15, due_day=3, today=Feb 19 → due Mar 3
    due = get_due_date(15, 3, reference=date(2026, 2, 19))
    assert due == date(2026, 3, 3)


def test_days_until_due():
    assert days_until_due(date(2026, 3, 3), reference=date(2026, 2, 19)) == 12


def test_days_until_due_overdue():
    assert days_until_due(date(2026, 2, 10), reference=date(2026, 2, 19)) == -9


def test_statement_day_on_last_day_of_month():
    # statement_day=31, Feb only has 28 days — should not crash
    result = get_closed_statement_period(31, reference=date(2026, 2, 19))
    assert result["period_end"].month in (1, 2)
