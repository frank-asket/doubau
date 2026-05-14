"""Optional employer logo URL on catalog jobs (JSearch, Remote OK, …).

Revision ID: 0024_job_employer_logo_url
Revises: 0023_application_role_report
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024_job_employer_logo_url"
down_revision: str | None = "0023_application_role_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("employer_logo_url", sa.String(length=2000), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "employer_logo_url")
