"""Application submitted_at for Phase A receipt (UI + optional self-email).

Revision ID: 0019_app_submitted_at
Revises: 0018_user_linkedin_tokens
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019_app_submitted_at"
down_revision: str | None = "0018_user_linkedin_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "submitted_at")
