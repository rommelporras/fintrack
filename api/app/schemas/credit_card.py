import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.schemas.institution import InstitutionBrief


class CreditCardCreate(BaseModel):
    account_id: uuid.UUID
    last_four: str
    credit_limit: Decimal | None = None
    statement_day: int
    due_day: int
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None

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
    credit_limit: Decimal | None = None
    statement_day: int | None = None
    due_day: int | None = None
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None

    @field_validator("statement_day", "due_day")
    @classmethod
    def validate_day(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 28:
            raise ValueError("Day must be between 1 and 28")
        return v


class CreditCardResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    institution: InstitutionBrief | None  # derived from credit_line.institution or account.institution
    last_four: str
    credit_limit: Decimal | None
    statement_day: int
    due_day: int
    closed_period: dict | None = None
    open_period: dict | None = None
    due_date: date | None = None
    days_until_due: int | None = None
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None
    available_credit: Decimal | None = None

    model_config = {"from_attributes": True}
