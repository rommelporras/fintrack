import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.recurring_transaction import RecurrenceFrequency
from app.models.transaction import TransactionSubType, TransactionType


class RecurringTransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    amount: Decimal
    description: str = ""
    type: TransactionType
    sub_type: TransactionSubType | None = None
    frequency: RecurrenceFrequency
    start_date: date
    end_date: date | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class RecurringTransactionUpdate(BaseModel):
    amount: Decimal | None = None
    description: str | None = None
    frequency: RecurrenceFrequency | None = None
    end_date: date | None = None
    is_active: bool | None = None
    category_id: uuid.UUID | None = None


class RecurringTransactionResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    category_id: uuid.UUID | None
    amount: Decimal
    description: str
    type: TransactionType
    sub_type: TransactionSubType | None
    frequency: RecurrenceFrequency
    start_date: date
    end_date: date | None
    next_due_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
