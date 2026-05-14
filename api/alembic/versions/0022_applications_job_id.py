"""Optional FK from applications to jobs (Discovery linkage).

Revision ID: 0022_applications_job_id
Revises: 0021_followup_reminder_notified
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0022_applications_job_id"
down_revision: str | None = "0021_followup_reminder_notified"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_foreign_key(
        "fk_applications_job_id_jobs",
        "applications",
        "jobs",
        ["job_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_applications_job_id_jobs", "applications", type_="foreignkey")
    op.drop_index("ix_applications_job_id", table_name="applications")
    op.drop_column("applications", "job_id")
