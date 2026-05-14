"""Track which follow-up instant was last emailed (one nudge per scheduled time).

Revision ID: 0021_followup_reminder_notified
Revises: 0020_application_tracker_crm
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021_followup_reminder_notified"
down_revision: str | None = "0020_application_tracker_crm"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("followup_notified_for_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "followup_notified_for_at")
