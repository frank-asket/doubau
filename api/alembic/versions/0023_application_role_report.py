"""Structured role insight report JSON on applications.

Revision ID: 0023_application_role_report
Revises: 0022_applications_job_id
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0023_application_role_report"
down_revision: str | None = "0022_applications_job_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("role_report", JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column(
        "applications",
        sa.Column("role_report_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "role_report_updated_at")
    op.drop_column("applications", "role_report")
