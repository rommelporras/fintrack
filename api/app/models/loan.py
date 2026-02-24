import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Date, DateTime, Integer, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class LoanType(str, enum.Enum):
    auto = "auto"
    housing = "housing"
    personal = "personal"
    education = "education"
    other = "other"


class LoanStatus(str, enum.Enum):
    active = "active"
    paid_off = "paid_off"
    transferred = "transferred"


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[LoanType] = mapped_column(nullable=False)
    original_principal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_amortization: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[LoanStatus] = mapped_column(nullable=False, default=LoanStatus.active)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    institution: Mapped["Institution | None"] = relationship(  # type: ignore[name-defined]
        "Institution", lazy="selectin"
    )
