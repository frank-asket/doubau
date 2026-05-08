from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# Must match Alembic 0007 + text-embedding-3-small dimension (1536).
_EMBEDDING_DIM = 1536


class ResumeStatus:
    UPLOADED = "UPLOADED"
    PARSED = "PARSED"
    EMBEDDED = "EMBEDDED"
    FAILED = "FAILED"


class ResumeDocument(Base):
    __tablename__ = "resume_documents"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default=ResumeStatus.UPLOADED,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(260), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    s3_bucket: Mapped[str] = mapped_column(String(120), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False, index=True)

    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # JSONB + pgvector: debug/portability vs similarity queries (Phase 2+).
    embedding: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)
    embedding_vector: Mapped[list[float] | None] = mapped_column(
        Vector(_EMBEDDING_DIM),
        nullable=True,
    )
    embedding_model: Mapped[str | None] = mapped_column(String(80), nullable=True)

    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        index=True,
    )

