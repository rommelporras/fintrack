import uuid
from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    icon: str | None = None
    color: str | None = None
    type: str  # income | expense | transfer


class CategoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    icon: str | None
    color: str | None
    type: str
    is_system: bool

    model_config = {"from_attributes": True}
