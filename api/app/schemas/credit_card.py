import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, field_validator


class CreditCardCreate(BaseModel):
    account_id: uuid.UUID
    bank_name: str
    last_four: str
    credit_limit: Decimal | None = None
    statement_day: int
    due_day: int

    @field_validator("statement_day", "due_day")
    @classmethod
    def validate_day(cls, v: int) -> int:
        if not 1 <= v <= 28:
            raise ValueError("Day must be between 1 and 28 (capped at 28 to avoid month-end edge cases)")
        return v

    @field_validator("last_four")
    @classmethod
    def validate_last_four(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("last_four must be exactly 4 digits")
        return v


class CreditCardUpdate(BaseModel):
    bank_name: str | None = None
    credit_limit: Decimal | None = None
    statement_day: int | None = None
    due_day: int | None = None

    @field_validator("statement_day", "due_day")
    @classmethod
    def validate_day(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 28:
            raise ValueError("Day must be between 1 and 28")
        return v


class CreditCardResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    bank_name: str
    last_four: str
    credit_limit: Decimal | None
    statement_day: int
    due_day: int
    closed_period: dict | None = None   # injected: last closed statement period
    open_period: dict | None = None     # injected: current open billing period
    due_date: date | None = None        # injected: next payment due date
    days_until_due: int | None = None   # injected

    model_config = {"from_attributes": True}
