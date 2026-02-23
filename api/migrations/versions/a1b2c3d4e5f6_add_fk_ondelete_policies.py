"""add FK ondelete policies

Revision ID: a1b2c3d4e5f6
Revises: bad965c5317c
Create Date: 2026-02-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "bad965c5317c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ondelete rules to all foreign keys that were missing them.

    transactions table:
      - account_id       → RESTRICT  (prevent deleting account with transactions)
      - category_id      → SET NULL  (nullable, ok to orphan)
      - to_account_id    → SET NULL  (nullable transfer destination)
      - document_id      → SET NULL  (nullable, source doc)
      - recurring_id     → SET NULL  (nullable recurring link)  [named constraint]
      - fee_category_id  → SET NULL  (nullable fee category)
      - created_by       → CASCADE   (delete transactions when user deleted)

    recurring_transactions table:
      - account_id       → CASCADE   (delete rules when account deleted)
      - category_id      → SET NULL  (nullable, ok to orphan)
    """
    # --- transactions: account_id (RESTRICT) ---
    op.drop_constraint(
        "transactions_account_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_account_id_fkey",
        "transactions",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # --- transactions: category_id (SET NULL) ---
    op.drop_constraint(
        "transactions_category_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_category_id_fkey",
        "transactions",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- transactions: to_account_id (SET NULL) ---
    op.drop_constraint(
        "transactions_to_account_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_to_account_id_fkey",
        "transactions",
        "accounts",
        ["to_account_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- transactions: document_id (SET NULL) ---
    op.drop_constraint(
        "transactions_document_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_document_id_fkey",
        "transactions",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- transactions: recurring_id (SET NULL) — was created with explicit name ---
    op.drop_constraint(
        "fk_transactions_recurring_id", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_transactions_recurring_id",
        "transactions",
        "recurring_transactions",
        ["recurring_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- transactions: fee_category_id (SET NULL) ---
    op.drop_constraint(
        "transactions_fee_category_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_fee_category_id_fkey",
        "transactions",
        "categories",
        ["fee_category_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- transactions: created_by (CASCADE) ---
    op.drop_constraint(
        "transactions_created_by_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_created_by_fkey",
        "transactions",
        "users",
        ["created_by"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- recurring_transactions: account_id (CASCADE) ---
    op.drop_constraint(
        "recurring_transactions_account_id_fkey",
        "recurring_transactions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "recurring_transactions_account_id_fkey",
        "recurring_transactions",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- recurring_transactions: category_id (SET NULL) ---
    op.drop_constraint(
        "recurring_transactions_category_id_fkey",
        "recurring_transactions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "recurring_transactions_category_id_fkey",
        "recurring_transactions",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Remove ondelete rules — restore FK constraints without ondelete."""
    # --- recurring_transactions: category_id ---
    op.drop_constraint(
        "recurring_transactions_category_id_fkey",
        "recurring_transactions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "recurring_transactions_category_id_fkey",
        "recurring_transactions",
        "categories",
        ["category_id"],
        ["id"],
    )

    # --- recurring_transactions: account_id ---
    op.drop_constraint(
        "recurring_transactions_account_id_fkey",
        "recurring_transactions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "recurring_transactions_account_id_fkey",
        "recurring_transactions",
        "accounts",
        ["account_id"],
        ["id"],
    )

    # --- transactions: created_by ---
    op.drop_constraint(
        "transactions_created_by_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_created_by_fkey",
        "transactions",
        "users",
        ["created_by"],
        ["id"],
    )

    # --- transactions: fee_category_id ---
    op.drop_constraint(
        "transactions_fee_category_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_fee_category_id_fkey",
        "transactions",
        "categories",
        ["fee_category_id"],
        ["id"],
    )

    # --- transactions: recurring_id ---
    op.drop_constraint(
        "fk_transactions_recurring_id", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_transactions_recurring_id",
        "transactions",
        "recurring_transactions",
        ["recurring_id"],
        ["id"],
    )

    # --- transactions: document_id ---
    op.drop_constraint(
        "transactions_document_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_document_id_fkey",
        "transactions",
        "documents",
        ["document_id"],
        ["id"],
    )

    # --- transactions: to_account_id ---
    op.drop_constraint(
        "transactions_to_account_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_to_account_id_fkey",
        "transactions",
        "accounts",
        ["to_account_id"],
        ["id"],
    )

    # --- transactions: category_id ---
    op.drop_constraint(
        "transactions_category_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_category_id_fkey",
        "transactions",
        "categories",
        ["category_id"],
        ["id"],
    )

    # --- transactions: account_id ---
    op.drop_constraint(
        "transactions_account_id_fkey", "transactions", type_="foreignkey"
    )
    op.create_foreign_key(
        "transactions_account_id_fkey",
        "transactions",
        "accounts",
        ["account_id"],
        ["id"],
    )
