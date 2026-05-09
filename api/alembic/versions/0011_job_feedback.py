"""Job feedback (hide/downvote) to tune ranking.

Revision ID: 0011_job_feedback
Revises: 0010_job_external_ref_posted_at
Create Date: 2026-05-09
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_job_feedback"
down_revision: str | None = "0010_job_external_ref_posted_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_feedback",
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
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.String(length=240), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "job_id", name="uq_job_feedback_user_job"),
    )
    op.create_index("ix_job_feedback_user_id", "job_feedback", ["user_id"])
    op.create_index("ix_job_feedback_job_id", "job_feedback", ["job_id"])
    op.create_index("ix_job_feedback_action", "job_feedback", ["action"])


def downgrade() -> None:
    op.drop_index("ix_job_feedback_action", table_name="job_feedback")
    op.drop_index("ix_job_feedback_job_id", table_name="job_feedback")
    op.drop_index("ix_job_feedback_user_id", table_name="job_feedback")
    op.drop_table("job_feedback")

