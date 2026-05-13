from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserLinkedInToken(Base):
    """LinkedIn OAuth tokens + last OpenID userinfo snapshot for Doubow profile sync."""

    __tablename__ = "user_linkedin_tokens"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    refresh_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    linkedin_sub: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    primary_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    profile_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="linkedin_token")  # noqa: UP037
