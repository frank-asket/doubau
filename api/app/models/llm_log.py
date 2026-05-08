from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LlmLog(Base):
    __tablename__ = "llm_logs"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    agent_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raw_output: Mapped[str] = mapped_column(Text, nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user_edit: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)

