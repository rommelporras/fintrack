import enum
import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import DateTime, Date, Index, Numeric, ForeignKey, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class TransactionSubType(str, enum.Enum):
    # Income
    salary = "salary"
    thirteenth_month = "thirteenth_month"
    bonus = "bonus"
    overtime = "overtime"
    freelance = "freelance"
    business = "business"
    consulting = "consulting"
    rental = "rental"
    interest = "interest"
    dividends = "dividends"
    capital_gains = "capital_gains"
    sss_benefit = "sss_benefit"
    philhealth_reimbursement = "philhealth_reimbursement"
    pagibig_dividend = "pagibig_dividend"
    government_aid = "government_aid"
    remittance_received = "remittance_received"
    gift_received = "gift_received"
    tax_refund = "tax_refund"
    sale_of_items = "sale_of_items"
    refund_cashback = "refund_cashback"
    other_income = "other_income"
    # Expense
    regular = "regular"
    gift_given = "gift_given"
    bill_payment = "bill_payment"
    subscription = "subscription"
    other_expense = "other_expense"
    # Transfer
    own_account = "own_account"
    sent_to_person = "sent_to_person"
    atm_withdrawal = "atm_withdrawal"


class TransactionSource(str, enum.Enum):
    manual = "manual"
    paste_ai = "paste_ai"
    pdf = "pdf"
    csv_import = "csv_import"
    recurring = "recurring"


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_user_date", "user_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    to_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True,
        index=True,
        comment="For transfer type: destination account (own_account sub_type only)"
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True,
        index=True,
    )
    recurring_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recurring_transactions.id", ondelete="SET NULL"), nullable=True,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[TransactionType] = mapped_column(nullable=False)
    sub_type: Mapped[TransactionSubType | None] = mapped_column(nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[TransactionSource] = mapped_column(default=TransactionSource.manual)

    # ATM withdrawal / bank fee support
    # Example: withdraw ₱5,000 from GCash at other bank ATM
    #   amount = 5000.00 (cash received)
    #   fee_amount = 18.00 (ATM fee)
    #   Total deducted from account = 5,018.00
    fee_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True,
        comment="Optional fee charged on this transaction (e.g. ATM fee, bank charge)"
    )
    fee_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True,
        index=True,
        comment="Category for the fee (defaults to ATM Fees / Bank Transaction Fees)"
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
