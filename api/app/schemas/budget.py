import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, field_validator, model_validator


class BudgetCreate(BaseModel):
    type: str  # "category" | "account"
    category_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    amount: Decimal

    @model_validator(mode="after")
    def validate_target(self) -> "BudgetCreate":
        if self.type not in ("category", "account"):
            raise ValueError("type must be 'category' or 'account'")
        if self.type == "category" and not self.category_id:
            raise ValueError("category_id required for category budgets")
        if self.type == "account" and not self.account_id:
            raise ValueError("account_id required for account budgets")
        if self.amount <= 0:
            raise ValueError("amount must be positive")
        return self


class BudgetUpdate(BaseModel):
    amount: Decimal | None = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class BudgetResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    category_id: uuid.UUID | None
    account_id: uuid.UUID | None
    amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
