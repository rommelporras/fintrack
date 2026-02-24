import uuid
from decimal import Decimal
from pydantic import BaseModel


class CreditLineCreate(BaseModel):
    name: str
    total_limit: Decimal | None = None
    available_override: Decimal | None = None


class CreditLineUpdate(BaseModel):
    name: str | None = None
    total_limit: Decimal | None = None
    available_override: Decimal | None = None


class CreditCardInLine(BaseModel):
    """Minimal card info nested inside CreditLineResponse."""
    id: uuid.UUID
    bank_name: str
    card_name: str | None
    last_four: str
    statement_day: int
    due_day: int
    account_id: uuid.UUID
    closed_period: dict | None = None
    open_period: dict | None = None
    due_date: str | None = None
    days_until_due: int | None = None

    model_config = {"from_attributes": True}


class CreditLineResponse(BaseModel):
    id: uuid.UUID
    name: str
    total_limit: Decimal | None
    available_override: Decimal | None
    available_credit: Decimal | None  # computed
    cards: list[CreditCardInLine]

    model_config = {"from_attributes": True}
