import uuid
from decimal import Decimal
from pydantic import BaseModel
from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    opening_balance: Decimal = Decimal("0.00")
    currency: str = "PHP"


class AccountUpdate(BaseModel):
    name: str | None = None
    opening_balance: Decimal | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: AccountType
    opening_balance: Decimal
    current_balance: Decimal  # computed, injected by router
    currency: str
    is_active: bool

    model_config = {"from_attributes": True}
