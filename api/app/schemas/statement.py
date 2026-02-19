import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class StatementCreate(BaseModel):
    credit_card_id: uuid.UUID
    period_start: date
    period_end: date
    due_date: date
    total_amount: Decimal | None = None
    minimum_due: Decimal | None = None


class StatementUpdate(BaseModel):
    period_start: date | None = None
    period_end: date | None = None
    due_date: date | None = None
    total_amount: Decimal | None = None
    minimum_due: Decimal | None = None
    is_paid: bool | None = None


class StatementResponse(BaseModel):
    id: uuid.UUID
    credit_card_id: uuid.UUID
    document_id: uuid.UUID | None
    period_start: date
    period_end: date
    due_date: date
    total_amount: Decimal | None
    minimum_due: Decimal | None
    is_paid: bool
    paid_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
