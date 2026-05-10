"""Six structured tools for the Career Copilot LangChain agent."""

from __future__ import annotations

import json
from uuid import UUID

from langchain_core.tools import StructuredTool
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.agents.interview_rag import load_job_description_for_application, retrieve_resume_context_for_role
from app.agents.outreach import (
    generate_email_draft_content,
    generate_interview_prep_content,
    generate_linkedin_draft_content,
    latest_resume_excerpt_for_user,
    latest_resume_full_text,
)
from app.models.application import Application, ApplicationStatus
from app.models.job import Job
from app.models.outreach_draft import DraftStatus, OutreachDraft
from app.state_machine import InvalidTransition, assert_transition


def build_copilot_tools(db: Session, user_id: UUID) -> list[StructuredTool]:
    def list_my_applications() -> str:
        rows = db.scalars(select(Application).where(Application.user_id == user_id)).all()
        out = [
            {"id": str(a.id), "company": a.company, "title": a.job_title, "status": a.status.value}
            for a in rows
        ]
        return json.dumps(out)

    def get_application_detail(application_id: str) -> str:
        try:
            aid = UUID(application_id)
        except Exception:
            return json.dumps({"error": "invalid_uuid"})
        app = db.get(Application, aid)
        if app is None or app.user_id != user_id:
            return json.dumps({"error": "not_found"})
        drafts = db.scalars(select(OutreachDraft).where(OutreachDraft.application_id == aid)).all()
        return json.dumps(
            {
                "id": str(app.id),
                "company": app.company,
                "job_title": app.job_title,
                "source_url": app.source_url,
                "status": app.status.value,
                "drafts": [
                    {"channel": d.channel, "status": d.status.value, "snippet": d.content[:400]}
                    for d in drafts
                ],
            }
        )

    def generate_outreach_drafts(application_id: str) -> str:
        try:
            aid = UUID(application_id)
        except Exception:
            return json.dumps({"error": "invalid_uuid"})
        app = db.get(Application, aid)
        if app is None or app.user_id != user_id:
            return json.dumps({"error": "not_found"})
        try:
            assert_transition(app.status, ApplicationStatus.PENDING_APPROVAL)
        except InvalidTransition as e:
            return json.dumps({"error": str(e)})
        app.status = ApplicationStatus.PENDING_APPROVAL
        email_body, _ = generate_email_draft_content(db, app)
        li_body, _ = generate_linkedin_draft_content(db, app)
        db.add(
            OutreachDraft(
                application_id=app.id,
                channel="email",
                content=email_body,
                status=DraftStatus.DRAFT,
            )
        )
        db.add(
            OutreachDraft(
                application_id=app.id,
                channel="linkedin",
                content=li_body,
                status=DraftStatus.DRAFT,
            )
        )
        db.commit()
        return json.dumps({"ok": True, "application_status": app.status.value})

    def run_interview_prep(application_id: str) -> str:
        try:
            aid = UUID(application_id)
        except Exception:
            return json.dumps({"error": "invalid_uuid"})
        app = db.get(Application, aid)
        if app is None or app.user_id != user_id:
            return json.dumps({"error": "not_found"})
        desc = load_job_description_for_application(db, app.source_url)
        full_resume = latest_resume_full_text(db, user_id)
        excerpt_fallback = latest_resume_excerpt_for_user(db, user_id)
        rag_text, _rag_meta = retrieve_resume_context_for_role(
            resume_text=full_resume,
            company=app.company,
            job_title=app.job_title,
            job_description_excerpt=desc,
        )
        grounded = rag_text or excerpt_fallback

        data, _ = generate_interview_prep_content(
            db,
            user_id=user_id,
            company=app.company,
            job_title=app.job_title,
            description_excerpt=desc,
            grounded_resume_context=grounded,
            rag_meta_json=json.dumps(_rag_meta, sort_keys=True),
        )
        db.commit()
        return json.dumps(data)

    def search_jobs(query: str, limit: int = 10) -> str:
        q = (query or "").strip()
        if not q:
            return json.dumps([])
        lim = max(1, min(int(limit), 25))
        like = f"%{q}%"
        rows = db.scalars(
            select(Job)
            .where(or_(Job.title.ilike(like), Job.company.ilike(like)))
            .order_by(Job.created_at.desc())
            .limit(lim)
        ).all()
        out = [
            {
                "id": str(j.id),
                "title": j.title,
                "company": j.company,
                "source_url": j.source_url,
            }
            for j in rows
        ]
        return json.dumps(out)

    def latest_resume_summary() -> str:
        t = latest_resume_full_text(db, user_id, max_chars=8000)
        if not t:
            return json.dumps({"resume": None})
        return json.dumps({"chars": len(t), "excerpt": t[:3500]})

    return [
        StructuredTool.from_function(
            list_my_applications,
            name="list_my_applications",
            description="List the signed-in user's applications (id, company, title, status).",
        ),
        StructuredTool.from_function(
            get_application_detail,
            name="get_application_detail",
            description="Fetch one application by UUID, including draft snippets.",
        ),
        StructuredTool.from_function(
            generate_outreach_drafts,
            name="generate_outreach_drafts",
            description="Generate email and LinkedIn drafts; transitions application to PENDING_APPROVAL when valid.",
        ),
        StructuredTool.from_function(
            run_interview_prep,
            name="run_interview_prep",
            description="Return interview prep JSON (themes, questions, talking points) for an application UUID.",
        ),
        StructuredTool.from_function(
            search_jobs,
            name="search_jobs",
            description="Search published jobs by keyword (matches title or company).",
        ),
        StructuredTool.from_function(
            latest_resume_summary,
            name="latest_resume_summary",
            description="Return an excerpt of the user's latest résumé text.",
        ),
    ]
