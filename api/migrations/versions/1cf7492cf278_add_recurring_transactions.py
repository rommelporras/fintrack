"""add recurring transactions

Revision ID: 1cf7492cf278
Revises: 354769545a16
Create Date: 2026-02-20 15:17:38.007965

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "1cf7492cf278"
down_revision: Union[str, Sequence[str], None] = "354769545a16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new enum values (must be outside transaction)
    connection = op.get_bind()
    connection.execute(
        sa.text("COMMIT")
    )
    connection.execute(
        sa.text("ALTER TYPE transactionsource ADD VALUE IF NOT EXISTS 'recurring'")
    )
    connection.execute(
        sa.text("BEGIN")
    )

    # Create recurrencefrequency enum
    recurrence_enum = postgresql.ENUM(
        "daily", "weekly", "biweekly", "monthly", "yearly",
        name="recurrencefrequency",
        create_type=False,
    )
    recurrence_enum.create(connection, checkfirst=True)

    # Re-use existing enums via sa.text column type trick
    op.create_table(
        "recurring_transactions",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "type",
            postgresql.ENUM("income", "expense", "transfer", name="transactiontype", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "sub_type",
            postgresql.ENUM(
                "salary", "thirteenth_month", "bonus", "overtime", "freelance",
                "business", "consulting", "rental", "interest", "dividends",
                "capital_gains", "sss_benefit", "philhealth_reimbursement",
                "pagibig_dividend", "government_aid", "remittance_received",
                "gift_received", "tax_refund", "sale_of_items", "refund_cashback",
                "other_income", "regular", "gift_given", "bill_payment",
                "subscription", "other_expense", "own_account", "sent_to_person",
                "atm_withdrawal",
                name="transactionsubtype",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "frequency",
            recurrence_enum,
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recurring_transactions_next_due_date"),
        "recurring_transactions",
        ["next_due_date"],
        unique=False,
    )
    op.add_column("transactions", sa.Column("recurring_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_recurring_id",
        "transactions",
        "recurring_transactions",
        ["recurring_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_transactions_recurring_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "recurring_id")
    op.drop_index(op.f("ix_recurring_transactions_next_due_date"), table_name="recurring_transactions")
    op.drop_table("recurring_transactions")
    postgresql.ENUM(name="recurrencefrequency").drop(op.get_bind(), checkfirst=True)
