"""Create institutions table

Revision ID: e1f2a3b4c5d6
Revises: d2e3f4a5b6c7
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: str | None = "d2e3f4a5b6c7"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        "institutions",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "type",
            sa.Enum("traditional", "digital", "government", "in_house", name="institutiontype"),
            nullable=False,
        ),
        sa.Column("color", sa.String(7), nullable=True),
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
            name=op.f("fk_institutions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_institutions")),
    )
    op.create_index(op.f("ix_institutions_user_id"), "institutions", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_institutions_user_id"), table_name="institutions")
    op.drop_table("institutions")
    op.execute("DROP TYPE IF EXISTS institutiontype")
