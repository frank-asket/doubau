"""Application CRM-lite fields for tracker (notes, follow-up, tags).

Revision ID: 0020_application_tracker_crm
Revises: 0019_app_submitted_at
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0020_application_tracker_crm"
down_revision: str | None = "0019_app_submitted_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column(
        "applications",
        sa.Column("next_followup_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "applications",
        sa.Column("tags", postgresql.ARRAY(sa.String(length=48)), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "tags")
    op.drop_column("applications", "next_followup_at")
    op.drop_column("applications", "notes")
