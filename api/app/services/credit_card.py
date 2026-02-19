from datetime import date, timedelta
import calendar


def get_closed_statement_period(statement_day: int, reference: date | None = None) -> dict:
    """
    Returns the most recently CLOSED statement period.
    Used for: "what is my current outstanding bill?"

    Example: statement_day=15, today=Feb 19
    → period_start: Jan 16, period_end: Feb 15  (this statement is outstanding)
    """
    today = reference or date.today()

    if today.day > statement_day:
        # Statement already closed this month
        close_year, close_month = today.year, today.month
    else:
        # Statement hasn't closed yet this month; last close was previous month
        close_month = today.month - 1 if today.month > 1 else 12
        close_year = today.year if today.month > 1 else today.year - 1

    close_day = min(statement_day, calendar.monthrange(close_year, close_month)[1])
    period_end = date(close_year, close_month, close_day)

    # Period started the day after the previous close
    prev_month = close_month - 1 if close_month > 1 else 12
    prev_year = close_year if close_month > 1 else close_year - 1
    start_day = min(statement_day + 1, calendar.monthrange(prev_year, prev_month)[1])
    period_start = date(prev_year, prev_month, start_day)

    return {"period_start": period_start, "period_end": period_end}


def get_open_billing_period(statement_day: int, reference: date | None = None) -> dict:
    """
    Returns the currently OPEN billing period (where new charges are being recorded).
    Used for: "which period does this new transaction belong to?"

    Example: statement_day=15, today=Feb 19
    → period_start: Feb 16, period_end: Mar 15  (charges after Feb 15 go here)
    """
    closed = get_closed_statement_period(statement_day, reference)
    closed_end = closed["period_end"]

    # Open period starts the day after the last close
    period_start = closed_end + timedelta(days=1)

    # Open period ends on statement_day of the month after period_start
    open_end_month = period_start.month + 1 if period_start.month < 12 else 1
    open_end_year = period_start.year if period_start.month < 12 else period_start.year + 1
    open_end_day = min(statement_day, calendar.monthrange(open_end_year, open_end_month)[1])
    period_end = date(open_end_year, open_end_month, open_end_day)

    return {"period_start": period_start, "period_end": period_end}


def get_due_date(statement_day: int, due_day: int, reference: date | None = None) -> date:
    """
    Returns the payment due date for the currently outstanding statement.
    """
    closed = get_closed_statement_period(statement_day, reference)
    period_end = closed["period_end"]

    due_month = period_end.month + 1 if period_end.month < 12 else 1
    due_year = period_end.year if period_end.month < 12 else period_end.year + 1
    due_day_actual = min(due_day, calendar.monthrange(due_year, due_month)[1])
    return date(due_year, due_month, due_day_actual)


def days_until_due(due_date: date, reference: date | None = None) -> int:
    today = reference or date.today()
    return (due_date - today).days
