"""add profile persona

Revision ID: 0004_profile_persona
Revises: 0003_idempotency
Create Date: 2026-05-08

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0004_profile_persona"
down_revision = "0003_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("persona", sa.String(length=40), nullable=True))
    op.create_index("ix_profiles_persona", "profiles", ["persona"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_profiles_persona", table_name="profiles")
    op.drop_column("profiles", "persona")

