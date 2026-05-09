"""External provider ref + listing posted time for freshness and dedup.

Revision ID: 0010_job_external_ref_posted_at
Revises: 0009_job_listing_source
Create Date: 2026-05-08

"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_job_external_ref_posted_at"
down_revision: str | None = "0009_job_listing_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("external_ref", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "source_posted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index("ix_jobs_external_ref", "jobs", ["external_ref"])
    op.create_index(
        "ix_jobs_listing_external_unique",
        "jobs",
        ["listing_source", "external_ref"],
        unique=True,
        postgresql_where=sa.text("external_ref IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_listing_external_unique", table_name="jobs")
    op.drop_index("ix_jobs_external_ref", table_name="jobs")
    op.drop_column("jobs", "source_posted_at")
    op.drop_column("jobs", "external_ref")
