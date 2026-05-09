from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

_JOB_EMBEDDING_DIM = 1536


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    company: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(220), nullable=False, index=True)
    location: Mapped[str | None] = mapped_column(String(220), nullable=True, index=True)

    seniority: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True, index=True)
    source_url_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Ingestion provenance: e.g. remoteok, http_fetch, manual (see provider adapters / tasks).
    listing_source: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    external_ref: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    source_posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    embedding_vector: Mapped[list[float] | None] = mapped_column(
        Vector(_JOB_EMBEDDING_DIM),
        nullable=True,
    )
    embedding_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    raw_html_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)

    is_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    stale_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
