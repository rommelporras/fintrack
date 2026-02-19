# api/app/schemas/parse.py
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel


class ParsedTransaction(BaseModel):
    amount: Decimal | None = None
    date: str | None = None          # ISO: YYYY-MM-DD
    description: str | None = None
    type: str | None = None          # income | expense | transfer
    category_hint: str | None = None
    confidence: Literal["high", "medium", "low"]


class BulkParseResponse(BaseModel):
    transactions: list[ParsedTransaction]
    count: int
