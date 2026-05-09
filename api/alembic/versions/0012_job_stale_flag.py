"""Job stale flag for expiry/hiding old listings.

Revision ID: 0012_job_stale_flag
Revises: 0011_job_feedback
Create Date: 2026-05-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_job_stale_flag"
down_revision: str | None = "0011_job_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "is_stale",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("jobs", sa.Column("stale_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_jobs_is_stale", "jobs", ["is_stale"])
    op.create_index("ix_jobs_stale_at", "jobs", ["stale_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_stale_at", table_name="jobs")
    op.drop_index("ix_jobs_is_stale", table_name="jobs")
    op.drop_column("jobs", "stale_at")
    op.drop_column("jobs", "is_stale")

