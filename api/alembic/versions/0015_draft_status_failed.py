"""Add FAILED to draft_status enum for outbound retry semantics.

Revision ID: 0015_draft_status_failed
Revises: 0014_copilot_sessions_phase3
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0015_draft_status_failed"
down_revision: str | None = "0014_copilot_sessions_phase3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE draft_status ADD VALUE IF NOT EXISTS 'FAILED'")


def downgrade() -> None:
    # PostgreSQL cannot drop enum values safely; leave FAILED in place.
    pass
