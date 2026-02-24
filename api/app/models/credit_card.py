import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Integer, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    credit_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("credit_lines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    card_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    available_override: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    credit_line: Mapped["CreditLine | None"] = relationship(  # type: ignore[name-defined]
        "CreditLine", back_populates="cards", lazy="selectin"
    )

    statement_day: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
