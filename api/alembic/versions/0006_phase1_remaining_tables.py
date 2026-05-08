"""phase1 remaining tables (llm_logs, check_ins, milestones, resume_documents)

Revision ID: 0006_phase1_tables
Revises: 0005_jobs
Create Date: 2026-05-08

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006_phase1_tables"
down_revision = "0005_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_name", sa.String(length=80), nullable=False),
        sa.Column("prompt_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_output", sa.Text(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("user_edit", sa.Text(), nullable=True),
        sa.Column("feedback_score", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_llm_logs_user_id", "llm_logs", ["user_id"])
    op.create_index("ix_llm_logs_agent_name", "llm_logs", ["agent_name"])
    op.create_index("ix_llm_logs_prompt_hash", "llm_logs", ["prompt_hash"])
    op.create_index("ix_llm_logs_created_at", "llm_logs", ["created_at"])

    op.create_table(
        "check_ins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mood", sa.Integer(), nullable=True),
        sa.Column("energy", sa.Integer(), nullable=True),
        sa.Column("workload", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_check_ins_user_id", "check_ins", ["user_id"])
    op.create_index("ix_check_ins_created_at", "check_ins", ["created_at"])

    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=40), server_default=sa.text("'todo'"), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "meta",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
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
    op.create_index("ix_milestones_user_id", "milestones", ["user_id"])
    op.create_index("ix_milestones_status", "milestones", ["status"])
    op.create_index("ix_milestones_due_date", "milestones", ["due_date"])
    op.create_index("ix_milestones_created_at", "milestones", ["created_at"])
    op.create_index("ix_milestones_updated_at", "milestones", ["updated_at"])

    op.create_table(
        "resume_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=40), server_default=sa.text("'UPLOADED'"), nullable=False),
        sa.Column("file_name", sa.String(length=260), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("s3_bucket", sa.String(length=120), nullable=False),
        sa.Column("s3_key", sa.String(length=512), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("parsed_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("embedding", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("embedding_model", sa.String(length=80), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
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
    op.create_index("ix_resume_documents_user_id", "resume_documents", ["user_id"])
    op.create_index("ix_resume_documents_status", "resume_documents", ["status"])
    op.create_index("ix_resume_documents_s3_key", "resume_documents", ["s3_key"])
    op.create_index("ix_resume_documents_created_at", "resume_documents", ["created_at"])
    op.create_index("ix_resume_documents_updated_at", "resume_documents", ["updated_at"])


def downgrade() -> None:
    op.drop_index("ix_resume_documents_updated_at", table_name="resume_documents")
    op.drop_index("ix_resume_documents_created_at", table_name="resume_documents")
    op.drop_index("ix_resume_documents_s3_key", table_name="resume_documents")
    op.drop_index("ix_resume_documents_status", table_name="resume_documents")
    op.drop_index("ix_resume_documents_user_id", table_name="resume_documents")
    op.drop_table("resume_documents")

    op.drop_index("ix_milestones_updated_at", table_name="milestones")
    op.drop_index("ix_milestones_created_at", table_name="milestones")
    op.drop_index("ix_milestones_due_date", table_name="milestones")
    op.drop_index("ix_milestones_status", table_name="milestones")
    op.drop_index("ix_milestones_user_id", table_name="milestones")
    op.drop_table("milestones")

    op.drop_index("ix_check_ins_created_at", table_name="check_ins")
    op.drop_index("ix_check_ins_user_id", table_name="check_ins")
    op.drop_table("check_ins")

    op.drop_index("ix_llm_logs_created_at", table_name="llm_logs")
    op.drop_index("ix_llm_logs_prompt_hash", table_name="llm_logs")
    op.drop_index("ix_llm_logs_agent_name", table_name="llm_logs")
    op.drop_index("ix_llm_logs_user_id", table_name="llm_logs")
    op.drop_table("llm_logs")

