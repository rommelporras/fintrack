"""Accounts: add institution_id FK and rename AccountType enum values

Revision ID: e2f3a4b5c6d7
Revises: e1f2a3b4c5d6
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e2f3a4b5c6d7"
down_revision: str | None = "e1f2a3b4c5d6"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    # Rename existing enum values
    op.execute("ALTER TYPE accounttype RENAME VALUE 'bank' TO 'savings'")
    op.execute("ALTER TYPE accounttype RENAME VALUE 'digital_wallet' TO 'wallet'")
    # Add new enum values
    op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'checking'")
    op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'loan'")

    # Add institution_id FK column (nullable, SET NULL on institution delete)
    op.add_column("accounts", sa.Column("institution_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_accounts_institution_id_institutions"),
        "accounts",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_accounts_institution_id"), "accounts", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_accounts_institution_id"), table_name="accounts")
    op.drop_constraint(
        op.f("fk_accounts_institution_id_institutions"),
        "accounts",
        type_="foreignkey",
    )
    op.drop_column("accounts", "institution_id")
    # Note: PostgreSQL does not support removing enum values without recreating the type.
    # Renaming back is possible:
    op.execute("ALTER TYPE accounttype RENAME VALUE 'savings' TO 'bank'")
    op.execute("ALTER TYPE accounttype RENAME VALUE 'wallet' TO 'digital_wallet'")
