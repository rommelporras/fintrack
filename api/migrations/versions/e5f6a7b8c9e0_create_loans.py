"""Create loans table (schema only — no routes or UI yet)

Revision ID: e5f6a7b8c9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9e0"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        "loans",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("institution_id", sa.UUID(), nullable=True),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "type",
            sa.Enum("auto", "housing", "personal", "education", "other", name="loantype"),
            nullable=False,
        ),
        sa.Column("original_principal", sa.Numeric(15, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(7, 4), nullable=True),
        sa.Column("term_months", sa.Integer(), nullable=True),
        sa.Column("monthly_amortization", sa.Numeric(15, 2), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "paid_off", "transferred", name="loanstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name=op.f("fk_loans_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["institution_id"], ["institutions.id"],
            name=op.f("fk_loans_institution_id_institutions"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"], ["accounts.id"],
            name=op.f("fk_loans_account_id_accounts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_loans")),
    )
    op.create_index(op.f("ix_loans_user_id"), "loans", ["user_id"])
    op.create_index(op.f("ix_loans_institution_id"), "loans", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_loans_institution_id"), table_name="loans")
    op.drop_index(op.f("ix_loans_user_id"), table_name="loans")
    op.drop_table("loans")
    op.execute("DROP TYPE IF EXISTS loantype")
    op.execute("DROP TYPE IF EXISTS loanstatus")
