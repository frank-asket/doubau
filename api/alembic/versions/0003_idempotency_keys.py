"""idempotency keys

Revision ID: 0003_idempotency
Revises: 0002_apps
Create Date: 2026-05-08

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003_idempotency"
down_revision = "0002_apps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("request_body_sha256", sa.String(length=64), nullable=True),
        sa.Column("response_status_code", sa.Integer(), nullable=False),
        sa.Column("response_media_type", sa.String(length=200), nullable=True),
        sa.Column(
            "response_headers",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("response_body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "key", name="uq_idempotency_keys_user_id_key"),
    )
    op.create_index("ix_idempotency_keys_user_id", "idempotency_keys", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_idempotency_keys_user_id", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")

