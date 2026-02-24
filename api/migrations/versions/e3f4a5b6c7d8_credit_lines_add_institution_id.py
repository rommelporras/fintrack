"""Credit lines: add institution_id FK

Revision ID: e3f4a5b6c7d8
Revises: e2f3a4b5c6d7
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: str | None = "e2f3a4b5c6d7"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.add_column("credit_lines", sa.Column("institution_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_credit_lines_institution_id_institutions"),
        "credit_lines",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_credit_lines_institution_id"), "credit_lines", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_lines_institution_id"), table_name="credit_lines")
    op.drop_constraint(
        op.f("fk_credit_lines_institution_id_institutions"),
        "credit_lines",
        type_="foreignkey",
    )
    op.drop_column("credit_lines", "institution_id")
