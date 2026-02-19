# api/tests/test_prompt.py
from app.services.prompt import generate_prompt
from app.models.document import DocumentType


def test_receipt_prompt_contains_json_schema():
    p = generate_prompt(DocumentType.receipt)
    assert "amount" in p
    assert "date" in p
    assert "description" in p
    assert "JSON" in p


def test_cc_statement_prompt_contains_array():
    p = generate_prompt(DocumentType.cc_statement)
    assert "[" in p  # array syntax
    assert "amount" in p


def test_other_prompt_is_generic():
    p = generate_prompt(DocumentType.other)
    assert len(p) > 20
