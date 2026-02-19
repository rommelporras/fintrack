# api/tests/test_parse.py
from decimal import Decimal
from app.services.parser import parse_text, parse_bulk


def test_parse_valid_json_high_confidence():
    text = '{"amount": 500.00, "date": "2026-02-19", "description": "Jollibee", "type": "expense", "category_hint": "Food"}'
    result = parse_text(text)
    assert result.amount == Decimal("500.00")
    assert result.date == "2026-02-19"
    assert result.description == "Jollibee"
    assert result.type == "expense"
    assert result.confidence == "high"


def test_parse_json_missing_optional_fields_medium_confidence():
    text = '{"amount": 200.00, "date": "2026-02-19"}'
    result = parse_text(text)
    assert result.amount == Decimal("200.00")
    assert result.confidence == "medium"


def test_parse_json_with_string_amount():
    text = '{"amount": "1,500.00", "date": "2026-02-19", "type": "expense"}'
    result = parse_text(text)
    assert result.amount == Decimal("1500.00")


def test_parse_sms_bank_alert():
    text = "Your BDO account ending 1234 was debited ₱500.00 on Feb 19, 2026 at Jollibee SM North."
    result = parse_text(text)
    assert result.amount == Decimal("500.00")
    assert result.date == "2026-02-19"
    assert result.type == "expense"
    assert result.confidence in ("medium", "high")


def test_parse_email_receipt_credited():
    text = "₱25,000.00 has been credited to your account on 2026-02-15. Payroll from Acme Corp."
    result = parse_text(text)
    assert result.amount == Decimal("25000.00")
    assert result.type == "income"
    assert result.date == "2026-02-15"


def test_parse_low_confidence_gibberish():
    result = parse_text("hello world nothing useful here")
    assert result.confidence == "low"
    assert result.amount is None


def test_parse_bulk_json_array():
    text = '[{"amount": 100, "date": "2026-02-01", "description": "A", "type": "expense"}, {"amount": 200, "date": "2026-02-02", "description": "B", "type": "expense"}]'
    result = parse_bulk(text)
    assert result.count == 2
    assert result.transactions[0].amount == Decimal("100")
    assert result.transactions[1].amount == Decimal("200")


def test_parse_bulk_multiline_sms():
    text = (
        "Debited ₱100.00 at Store A on 2026-02-01.\n"
        "Debited ₱200.00 at Store B on 2026-02-02.\n"
    )
    result = parse_bulk(text)
    assert result.count == 2
