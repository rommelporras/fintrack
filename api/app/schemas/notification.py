import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    is_read: bool
    metadata_: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
