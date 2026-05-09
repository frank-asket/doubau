"""Job match quality events (impressions, clicks, etc).

Revision ID: 0013_job_match_events
Revises: 0012_job_stale_flag
Create Date: 2026-05-09
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_job_match_events"
down_revision: str | None = "0012_job_stale_flag"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_match_events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("reason", sa.String(length=240), nullable=True),
        sa.Column("meta", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_job_match_events_user_id", "job_match_events", ["user_id"])
    op.create_index("ix_job_match_events_job_id", "job_match_events", ["job_id"])
    op.create_index("ix_job_match_events_event_type", "job_match_events", ["event_type"])
    op.create_index("ix_job_match_events_created_at", "job_match_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_job_match_events_created_at", table_name="job_match_events")
    op.drop_index("ix_job_match_events_event_type", table_name="job_match_events")
    op.drop_index("ix_job_match_events_job_id", table_name="job_match_events")
    op.drop_index("ix_job_match_events_user_id", table_name="job_match_events")
    op.drop_table("job_match_events")

