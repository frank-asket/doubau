"""Persist Glassdoor company enrichment snapshots.

Revision ID: 0025_company_enrichments
Revises: 0024_job_employer_logo_url
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0025_company_enrichments"
down_revision: str | None = "0024_job_employer_logo_url"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "company_enrichments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("normalized_company", sa.String(length=220), nullable=False),
        sa.Column("company_name", sa.String(length=220), nullable=False),
        sa.Column("provider_ref", sa.String(length=120), nullable=True),
        sa.Column("website_url", sa.String(length=2000), nullable=True),
        sa.Column("logo_url", sa.String(length=2000), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("review_count", sa.Integer(), nullable=True),
        sa.Column("interview_count", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=False, server_default="glassdoor_realtime"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_company_enrichments_provider", "company_enrichments", ["provider"])
    op.create_index(
        "ix_company_enrichments_normalized_company",
        "company_enrichments",
        ["normalized_company"],
    )
    op.create_index("ix_company_enrichments_company_name", "company_enrichments", ["company_name"])
    op.create_index("ix_company_enrichments_provider_ref", "company_enrichments", ["provider_ref"])
    op.create_index("ix_company_enrichments_fetched_at", "company_enrichments", ["fetched_at"])
    op.create_index("ix_company_enrichments_created_at", "company_enrichments", ["created_at"])
    op.create_index("ix_company_enrichments_updated_at", "company_enrichments", ["updated_at"])
    op.create_unique_constraint(
        "uq_company_enrichments_provider_normalized_company",
        "company_enrichments",
        ["provider", "normalized_company"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_company_enrichments_provider_normalized_company",
        "company_enrichments",
        type_="unique",
    )
    op.drop_index("ix_company_enrichments_updated_at", table_name="company_enrichments")
    op.drop_index("ix_company_enrichments_created_at", table_name="company_enrichments")
    op.drop_index("ix_company_enrichments_fetched_at", table_name="company_enrichments")
    op.drop_index("ix_company_enrichments_provider_ref", table_name="company_enrichments")
    op.drop_index("ix_company_enrichments_company_name", table_name="company_enrichments")
    op.drop_index("ix_company_enrichments_normalized_company", table_name="company_enrichments")
    op.drop_index("ix_company_enrichments_provider", table_name="company_enrichments")
    op.drop_table("company_enrichments")
