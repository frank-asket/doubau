from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.profile import Profile
    from app.models.user_google_token import UserGoogleToken
    from app.models.user_linkedin_token import UserLinkedInToken


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    profile: Mapped["Profile | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    google_token: Mapped[UserGoogleToken | None] = relationship(
        "UserGoogleToken", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    linkedin_token: Mapped[UserLinkedInToken | None] = relationship(
        "UserLinkedInToken", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

