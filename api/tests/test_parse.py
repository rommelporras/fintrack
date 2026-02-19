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
