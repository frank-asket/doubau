"""Phase 2: job embeddings (pgvector), URL dedup hash, raw HTML pointer.

Revision ID: 0008_phase2_jobs_embedding
Revises: 0007_pgvector_embedding
Create Date: 2026-05-08

"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

revision: str = "0008_phase2_jobs_embedding"
down_revision: str | None = "0007_pgvector_embedding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("source_url_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "jobs",
        sa.Column("embedding_vector", Vector(1536), nullable=True),
    )
    op.add_column("jobs", sa.Column("embedding_model", sa.String(length=80), nullable=True))
    op.add_column("jobs", sa.Column("raw_html_s3_key", sa.String(length=512), nullable=True))
    op.add_column(
        "jobs",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_jobs_source_url_hash_unique",
        "jobs",
        ["source_url_hash"],
        unique=True,
        postgresql_where=sa.text("source_url_hash IS NOT NULL"),
    )

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_jobs_embedding_vector_hnsw "
            "ON jobs USING hnsw (embedding_vector vector_cosine_ops)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_jobs_embedding_vector_hnsw"))
    op.drop_index("ix_jobs_source_url_hash_unique", table_name="jobs")
    op.drop_column("jobs", "updated_at")
    op.drop_column("jobs", "raw_html_s3_key")
    op.drop_column("jobs", "embedding_model")
    op.drop_column("jobs", "embedding_vector")
    op.drop_column("jobs", "source_url_hash")
