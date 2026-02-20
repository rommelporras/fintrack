import uuid
import datetime as _dt
from decimal import Decimal
from pydantic import BaseModel, model_validator
from app.models.transaction import TransactionType, TransactionSubType, TransactionSource

date = _dt.date


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    to_account_id: uuid.UUID | None = None
    amount: Decimal
    description: str = ""
    type: TransactionType
    sub_type: TransactionSubType | None = None
    date: date
    source: TransactionSource = TransactionSource.manual
    fee_amount: Decimal | None = None
    fee_category_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_fields(self) -> "TransactionCreate":
        if self.type == TransactionType.transfer:
            if self.sub_type == TransactionSubType.own_account and not self.to_account_id:
                raise ValueError("to_account_id required for own_account transfers")
        if self.amount <= 0:
            raise ValueError("amount must be positive")
        if self.fee_amount is not None and self.fee_amount < 0:
            raise ValueError("fee_amount cannot be negative")
        return self



class TransactionUpdate(BaseModel):
    account_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    to_account_id: uuid.UUID | None = None
    amount: Decimal | None = None
    description: str | None = None
    type: TransactionType | None = None
    sub_type: TransactionSubType | None = None
    date: _dt.date | None = None
    source: TransactionSource | None = None
    fee_amount: Decimal | None = None
    fee_category_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_fields(self) -> "TransactionUpdate":
        if self.amount is not None and self.amount <= 0:
            raise ValueError("amount must be positive")
        if self.fee_amount is not None and self.fee_amount < 0:
            raise ValueError("fee_amount cannot be negative")
        return self


class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    category_id: uuid.UUID | None
    to_account_id: uuid.UUID | None
    amount: Decimal
    description: str
    type: TransactionType
    sub_type: TransactionSubType | None
    date: date
    source: TransactionSource
    fee_amount: Decimal | None
    fee_category_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: _dt.datetime
    updated_at: _dt.datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
