"""Store Gmail API message id after in-app send (open-in-Gmail + audit).

Revision ID: 0017_application_gmail_sent_message_id
Revises: 0016_user_google_tokens
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_application_gmail_sent_message_id"
down_revision: str | None = "0016_user_google_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("gmail_sent_message_id", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "gmail_sent_message_id")
