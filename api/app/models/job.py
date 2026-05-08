from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    company: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(220), nullable=False, index=True)
    location: Mapped[str | None] = mapped_column(String(220), nullable=True, index=True)

    # freeform fields for MVP; we can normalize later
    seniority: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)

