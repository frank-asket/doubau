"""Copilot sessions/messages for Phase 3 Career Copilot.

Revision ID: 0014_copilot_sessions_phase3
Revises: 0013_job_match_events
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_copilot_sessions_phase3"
down_revision: str | None = "0013_job_match_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "copilot_sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_copilot_sessions_user_id", "copilot_sessions", ["user_id"])

    op.create_table(
        "copilot_messages",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("copilot_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_copilot_messages_session_created",
        "copilot_messages",
        ["session_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_copilot_messages_session_created", table_name="copilot_messages")
    op.drop_table("copilot_messages")
    op.drop_index("ix_copilot_sessions_user_id", table_name="copilot_sessions")
    op.drop_table("copilot_sessions")
