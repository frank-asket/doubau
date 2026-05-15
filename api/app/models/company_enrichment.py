from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CompanyEnrichment(Base):
    __tablename__ = "company_enrichments"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    normalized_company: Mapped[str] = mapped_column(String(220), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(220), nullable=False, index=True)
    provider_ref: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    website_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interview_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    source: Mapped[str] = mapped_column(String(80), nullable=False, default="glassdoor_realtime")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        index=True,
    )
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
