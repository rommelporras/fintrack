# api/app/services/parser.py
import json
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime
from app.schemas.parse import ParsedTransaction, BulkParseResponse


def parse_text(text: str) -> ParsedTransaction:
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return _parse_json_obj(data)
    except (json.JSONDecodeError, ValueError):
        pass
    return _parse_freeform(text)


def parse_bulk(text: str) -> BulkParseResponse:
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            results = [_parse_json_obj(item) for item in data if isinstance(item, dict)]
        else:
            results = [_parse_json_obj(data)]
    except (json.JSONDecodeError, ValueError):
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        results = [r for r in (_parse_freeform(l) for l in lines) if r.amount is not None]
    return BulkParseResponse(transactions=results, count=len(results))


def _parse_json_obj(data: dict) -> ParsedTransaction:
    raw_amount = data.get("amount")
    amount = _to_decimal(raw_amount)
    date = _normalize_date(str(data["date"])) if data.get("date") else None
    txn_type = str(data["type"]) if data.get("type") else None
    description = str(data.get("description", "")) or None
    category_hint = str(data["category_hint"]) if data.get("category_hint") else None

    has_all = all(x is not None for x in [amount, date, txn_type])
    confidence = "high" if has_all else "medium"

    return ParsedTransaction(
        amount=amount,
        date=date,
        description=description,
        type=txn_type,
        category_hint=category_hint,
        confidence=confidence,
    )


def _to_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        clean = str(value).replace(",", "").strip()
        return Decimal(clean)
    except InvalidOperation:
        return None


def _normalize_date(raw: str) -> str | None:
    fmts = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y",
            "%B %d %Y", "%b %d %Y"]
    for fmt in fmts:
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_freeform(text: str) -> ParsedTransaction:
    amount = _extract_amount(text)
    date = _extract_date(text)
    description = _extract_merchant(text)
    txn_type = _extract_type(text)

    found = sum(1 for x in [amount, date, description, txn_type] if x is not None)
    confidence = "high" if found >= 4 else ("medium" if found >= 3 else "low")

    return ParsedTransaction(
        amount=amount,
        date=date,
        description=description,
        type=txn_type,
        confidence=confidence,
    )


def _extract_amount(text: str) -> Decimal | None:
    for pattern in [r"[₱PHP]\s*([\d,]+\.?\d*)", r"([\d,]+\.\d{2})\s*(?:PHP|peso)"]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            val = m.group(1).replace(",", "")
            try:
                return Decimal(val)
            except InvalidOperation:
                pass
    return None


def _extract_date(text: str) -> str | None:
    patterns = [
        r"\b(\d{4}-\d{2}-\d{2})\b",
        r"\b(\d{1,2}/\d{1,2}/\d{2,4})\b",
        r"\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            result = _normalize_date(m.group(1))
            if result:
                return result
    return None


def _extract_merchant(text: str) -> str | None:
    m = re.search(
        r"\bat\s+([A-Z][A-Za-z0-9 &'.,-]{2,40}?)(?:\s+on\b|\s+for\b|\.|$)", text
    )
    if m:
        return m.group(1).strip()
    m = re.search(
        r"\bto\s+([A-Z][A-Za-z0-9 &'.,-]{2,40}?)(?:\s+on\b|\s+dated\b|\.|$)", text
    )
    if m:
        return m.group(1).strip()
    return None


def _extract_type(text: str) -> str | None:
    lower = text.lower()
    if any(w in lower for w in ["debited", "deducted", "paid", "purchased", "charged"]):
        return "expense"
    if any(w in lower for w in ["credited", "received", "deposited", "salary", "payroll"]):
        return "income"
    if any(w in lower for w in ["transferred", "sent to", "transfer to"]):
        return "transfer"
    return None
