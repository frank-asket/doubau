"""pgvector extension + resume_documents.embedding_vector for OpenAI embeddings.

Revision ID: 0007_pgvector_embedding
Revises: 0006_phase1_tables
Create Date: 2026-05-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

revision: str = "0007_pgvector_embedding"
down_revision: str | None = "0006_phase1_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    op.add_column(
        "resume_documents",
        sa.Column("embedding_vector", Vector(1536), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("resume_documents", "embedding_vector")
