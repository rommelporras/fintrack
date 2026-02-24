"""extend credit_cards with credit_line_id, card_name, available_override

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-02-24 00:00:01.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('credit_cards', sa.Column('credit_line_id', sa.UUID(), nullable=True))
    op.add_column('credit_cards', sa.Column('card_name', sa.String(length=255), nullable=True))
    op.add_column('credit_cards', sa.Column('available_override', sa.Numeric(precision=15, scale=2), nullable=True))
    op.create_foreign_key(
        op.f('fk_credit_cards_credit_line_id'),
        'credit_cards', 'credit_lines',
        ['credit_line_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index(op.f('ix_credit_cards_credit_line_id'), 'credit_cards', ['credit_line_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_credit_cards_credit_line_id'), table_name='credit_cards')
    op.drop_constraint(op.f('fk_credit_cards_credit_line_id'), 'credit_cards', type_='foreignkey')
    op.drop_column('credit_cards', 'available_override')
    op.drop_column('credit_cards', 'card_name')
    op.drop_column('credit_cards', 'credit_line_id')
