"""Add listing_source for job provenance (adapter id: remoteok, http_fetch, etc.).

Revision ID: 0009_job_listing_source
Revises: 0008_phase2_jobs_embedding
Create Date: 2026-05-08

"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_job_listing_source"
down_revision: str | None = "0008_phase2_jobs_embedding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("listing_source", sa.String(length=80), nullable=True),
    )
    op.create_index("ix_jobs_listing_source", "jobs", ["listing_source"])


def downgrade() -> None:
    op.drop_index("ix_jobs_listing_source", table_name="jobs")
    op.drop_column("jobs", "listing_source")
