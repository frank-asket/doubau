"""Merge identity-provider snapshots into ``profiles.goals`` without clobbering unrelated keys."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import Profile


def merge_profile_goals(db: Session, *, user_id: UUID, patch: dict[str, Any]) -> None:
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if profile is None:
        profile = Profile(user_id=user_id, goals={})
        db.add(profile)
        db.flush()
    base: dict[str, Any] = dict(profile.goals) if isinstance(profile.goals, dict) else {}
    base.update(patch)
    profile.goals = base


def clear_goal_keys(db: Session, *, user_id: UUID, keys: tuple[str, ...]) -> None:
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if profile is None or not isinstance(profile.goals, dict):
        return
    base = dict(profile.goals)
    for k in keys:
        base.pop(k, None)
    profile.goals = base
