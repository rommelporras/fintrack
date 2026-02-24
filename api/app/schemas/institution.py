import uuid
from pydantic import BaseModel
from app.models.institution import InstitutionType


class InstitutionCreate(BaseModel):
    name: str
    type: InstitutionType
    color: str | None = None


class InstitutionUpdate(BaseModel):
    name: str | None = None
    type: InstitutionType | None = None
    color: str | None = None


class InstitutionBrief(BaseModel):
    """Minimal institution info for embedding in other responses."""
    id: uuid.UUID
    name: str
    type: InstitutionType
    color: str | None

    model_config = {"from_attributes": True}


class InstitutionResponse(InstitutionBrief):
    user_id: uuid.UUID
