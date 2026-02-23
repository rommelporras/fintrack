"""add check constraints

Revision ID: 788683df667d
Revises: 8d072f8535e5
Create Date: 2026-02-23 14:22:07.030298

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '788683df667d'
down_revision: Union[str, Sequence[str], None] = '8d072f8535e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint("ck_transactions_amount_positive", "transactions", "amount > 0")
    op.create_check_constraint("ck_budgets_amount_positive", "budgets", "amount > 0")
    op.create_check_constraint("ck_credit_cards_limit_positive", "credit_cards", "credit_limit >= 0")
    op.create_check_constraint("ck_credit_cards_statement_day", "credit_cards", "statement_day BETWEEN 1 AND 31")
    op.create_check_constraint("ck_credit_cards_due_day", "credit_cards", "due_day BETWEEN 1 AND 31")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_credit_cards_due_day", "credit_cards", type_="check")
    op.drop_constraint("ck_credit_cards_statement_day", "credit_cards", type_="check")
    op.drop_constraint("ck_credit_cards_limit_positive", "credit_cards", type_="check")
    op.drop_constraint("ck_budgets_amount_positive", "budgets", type_="check")
    op.drop_constraint("ck_transactions_amount_positive", "transactions", type_="check")
