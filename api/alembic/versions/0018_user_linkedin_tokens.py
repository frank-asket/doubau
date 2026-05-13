"""Per-user LinkedIn OAuth tokens + OpenID userinfo snapshot.

Revision ID: 0018_user_linkedin_tokens
Revises: 0017_gmail_sent_message_id
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0018_user_linkedin_tokens"
down_revision: str | None = "0017_gmail_sent_message_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_linkedin_tokens",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_ciphertext", sa.Text(), nullable=True),
        sa.Column("access_ciphertext", sa.Text(), nullable=True),
        sa.Column("access_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("linkedin_sub", sa.String(length=80), nullable=True),
        sa.Column("primary_email", sa.String(length=320), nullable=True),
        sa.Column("profile_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "ix_user_linkedin_tokens_linkedin_sub",
        "user_linkedin_tokens",
        ["linkedin_sub"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_linkedin_tokens_linkedin_sub", table_name="user_linkedin_tokens")
    op.drop_table("user_linkedin_tokens")
