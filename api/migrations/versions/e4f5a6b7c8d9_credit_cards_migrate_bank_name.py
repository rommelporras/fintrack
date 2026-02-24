"""Credit cards: copy bank_name to card_name for in-line cards, drop bank_name

Revision ID: e4f5a6b7c8d9
Revises: e3f4a5b6c7d8
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "e3f4a5b6c7d8"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    # For in-line cards (credit_line_id IS NOT NULL) with no card_name:
    # copy bank_name → card_name so existing product names are preserved.
    op.execute("""
        UPDATE credit_cards
        SET card_name = bank_name
        WHERE credit_line_id IS NOT NULL
          AND (card_name IS NULL OR card_name = '')
    """)

    # Drop bank_name column entirely
    op.drop_column("credit_cards", "bank_name")


def downgrade() -> None:
    # Restore bank_name column (nullable — we can't recover the original values)
    op.add_column(
        "credit_cards",
        sa.Column("bank_name", sa.String(255), nullable=True),
    )
    # Fill with card_name as a best-effort restore
    op.execute("UPDATE credit_cards SET bank_name = COALESCE(card_name, 'Unknown')")
    # Make it non-nullable
    op.alter_column("credit_cards", "bank_name", nullable=False)
