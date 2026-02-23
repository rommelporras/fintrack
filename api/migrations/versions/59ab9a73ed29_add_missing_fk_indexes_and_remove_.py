"""add missing fk indexes and remove redundant user_id index

Revision ID: 59ab9a73ed29
Revises: 97aae1548f45
Create Date: 2026-02-23 15:20:45.407420

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '59ab9a73ed29'
down_revision: Union[str, Sequence[str], None] = '97aae1548f45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # transactions: add indexes for FK columns that were missing them
    op.create_index(op.f('ix_transactions_to_account_id'), 'transactions', ['to_account_id'], unique=False)
    op.create_index(op.f('ix_transactions_document_id'), 'transactions', ['document_id'], unique=False)
    op.create_index(op.f('ix_transactions_recurring_id'), 'transactions', ['recurring_id'], unique=False)
    op.create_index(op.f('ix_transactions_fee_category_id'), 'transactions', ['fee_category_id'], unique=False)
    op.create_index(op.f('ix_transactions_created_by'), 'transactions', ['created_by'], unique=False)
    # transactions: drop ix_transactions_user_id — redundant, covered by ix_transactions_user_date
    op.drop_index(op.f('ix_transactions_user_id'), table_name='transactions')
    # recurring_transactions: add indexes for FK columns
    op.create_index(op.f('ix_recurring_transactions_account_id'), 'recurring_transactions', ['account_id'], unique=False)
    op.create_index(op.f('ix_recurring_transactions_category_id'), 'recurring_transactions', ['category_id'], unique=False)
    # budgets: add indexes for FK columns
    op.create_index(op.f('ix_budgets_category_id'), 'budgets', ['category_id'], unique=False)
    op.create_index(op.f('ix_budgets_account_id'), 'budgets', ['account_id'], unique=False)
    # credit_cards: add index for account_id FK
    op.create_index(op.f('ix_credit_cards_account_id'), 'credit_cards', ['account_id'], unique=False)
    # statements: add index for document_id FK
    op.create_index(op.f('ix_statements_document_id'), 'statements', ['document_id'], unique=False)
    # categories: add index for user_id FK
    op.create_index(op.f('ix_categories_user_id'), 'categories', ['user_id'], unique=False)
    # push_subscriptions: add index for user_id FK
    op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_push_subscriptions_user_id'), table_name='push_subscriptions')
    op.drop_index(op.f('ix_categories_user_id'), table_name='categories')
    op.drop_index(op.f('ix_statements_document_id'), table_name='statements')
    op.drop_index(op.f('ix_credit_cards_account_id'), table_name='credit_cards')
    op.drop_index(op.f('ix_budgets_account_id'), table_name='budgets')
    op.drop_index(op.f('ix_budgets_category_id'), table_name='budgets')
    op.drop_index(op.f('ix_recurring_transactions_category_id'), table_name='recurring_transactions')
    op.drop_index(op.f('ix_recurring_transactions_account_id'), table_name='recurring_transactions')
    op.drop_index(op.f('ix_transactions_created_by'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_fee_category_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_recurring_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_document_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_to_account_id'), table_name='transactions')
    # Restore ix_transactions_user_id that was dropped in upgrade
    op.create_index(op.f('ix_transactions_user_id'), 'transactions', ['user_id'], unique=False)
