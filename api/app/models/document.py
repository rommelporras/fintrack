import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class DocumentType(str, enum.Enum):
    receipt = "receipt"
    cc_statement = "cc_statement"
    other = "other"


class DocumentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class DocumentSourceModel(str, enum.Enum):
    manual_paste = "manual_paste"
    gemini = "gemini"
    claude = "claude"
    ollama = "ollama"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    document_type: Mapped[DocumentType] = mapped_column(nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(default=DocumentStatus.pending)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_model: Mapped[DocumentSourceModel | None] = mapped_column(nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
