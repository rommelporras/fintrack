import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.document import DocumentType, DocumentStatus


class DocumentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    file_path: str
    document_type: DocumentType
    status: DocumentStatus
    extracted_data: dict | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    status: DocumentStatus | None = None
    extracted_data: dict | None = None
    error_message: str | None = None
