# api/app/services/prompt.py
from app.models.document import DocumentType

_RECEIPT_PROMPT = (
    "This is a receipt. Extract the merchant name, total amount in PHP, "
    "transaction date, and suggest a category. "
    'Respond ONLY in JSON (no markdown): '
    '{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", '
    '"type": "expense", "category_hint": ""}'
)

_STATEMENT_PROMPT = (
    "This is a credit card statement. Extract each transaction as an array. "
    'Respond ONLY in JSON (no markdown): '
    '[{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", '
    '"type": "expense", "category_hint": ""}]'
)

_OTHER_PROMPT = (
    "Extract any financial transaction details from this document. "
    'Respond ONLY in JSON (no markdown): '
    '{"amount": 0.00, "date": "YYYY-MM-DD", "description": "", '
    '"type": "expense", "category_hint": ""}'
)

_PROMPTS = {
    DocumentType.receipt: _RECEIPT_PROMPT,
    DocumentType.cc_statement: _STATEMENT_PROMPT,
    DocumentType.other: _OTHER_PROMPT,
}


def generate_prompt(document_type: DocumentType) -> str:
    return _PROMPTS[document_type]
