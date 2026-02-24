import uuid
from decimal import Decimal
from pydantic import BaseModel
from app.models.account import AccountType
from app.schemas.institution import InstitutionBrief


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    institution_id: uuid.UUID | None = None
    opening_balance: Decimal = Decimal("0.00")
    currency: str = "PHP"
    is_active: bool = True


class AccountUpdate(BaseModel):
    name: str | None = None
    institution_id: uuid.UUID | None = None
    opening_balance: Decimal | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    institution_id: uuid.UUID | None
    institution: InstitutionBrief | None
    name: str
    type: AccountType
    opening_balance: Decimal
    current_balance: Decimal  # computed, injected by router
    currency: str
    is_active: bool

    model_config = {"from_attributes": True}
