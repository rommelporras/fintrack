import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InstitutionType(str, enum.Enum):
    traditional = "traditional"
    digital = "digital"
    government = "government"
    in_house = "in_house"


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[InstitutionType] = mapped_column(
        Enum(InstitutionType, name="institutiontype"), nullable=False
    )
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    accounts: Mapped[list["Account"]] = relationship(  # type: ignore[name-defined]
        "Account", back_populates="institution", lazy="select"
    )
    credit_lines: Mapped[list["CreditLine"]] = relationship(  # type: ignore[name-defined]
        "CreditLine", back_populates="institution", lazy="select"
    )
