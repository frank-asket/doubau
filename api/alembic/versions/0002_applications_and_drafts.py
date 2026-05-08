"""applications and outreach drafts

Revision ID: 0002_apps
Revises: 0001_init
Create Date: 2026-05-08

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_apps"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE application_status AS ENUM "
        "('DISCOVERED','SCORING','DRAFTED','PENDING_APPROVAL','APPROVED','SUBMITTED','FAILED','RETRY')"
    )
    op.execute("CREATE TYPE draft_status AS ENUM ('DRAFT','SENT')")

    application_status = postgresql.ENUM(name="application_status", create_type=False)
    draft_status = postgresql.ENUM(name="draft_status", create_type=False)

    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("job_title", sa.String(length=200), nullable=False),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column(
            "status",
            application_status,
            server_default=sa.text("'DISCOVERED'::application_status"),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])

    op.create_table(
        "outreach_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "channel",
            sa.String(length=40),
            server_default=sa.text("'email'"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "status",
            draft_status,
            server_default=sa.text("'DRAFT'::draft_status"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_outreach_drafts_application_id", "outreach_drafts", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_outreach_drafts_application_id", table_name="outreach_drafts")
    op.drop_table("outreach_drafts")
    op.drop_index("ix_applications_user_id", table_name="applications")
    op.drop_table("applications")
    op.execute("DROP TYPE draft_status")
    op.execute("DROP TYPE application_status")

