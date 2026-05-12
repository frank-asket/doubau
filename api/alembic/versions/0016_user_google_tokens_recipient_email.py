"""Gmail in-app send: per-user Google refresh token + optional application recipient email.

Revision ID: 0016_user_google_tokens_recipient_email
Revises: 0015_draft_status_failed
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_user_google_tokens_recipient_email"
down_revision: str | None = "0015_draft_status_failed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("recipient_email", sa.String(length=320), nullable=True))
    op.create_table(
        "user_google_tokens",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_ciphertext", sa.Text(), nullable=False),
        sa.Column("google_account_email", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_google_tokens")
    op.drop_column("applications", "recipient_email")
