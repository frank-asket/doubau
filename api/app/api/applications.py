import json
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.agents.interview_rag import load_job_description_for_application, retrieve_resume_context_for_role
from app.agents.outreach import (
    generate_email_draft_content,
    generate_interview_prep_content,
    generate_linkedin_draft_content,
    latest_resume_excerpt_for_user,
    latest_resume_full_text,
)
from app.api.deps import CurrentUserDep, DbDep
from app.llm.logging import record_llm_interaction
from app.models.application import Application, ApplicationStatus
from app.models.outreach_draft import DraftStatus, OutreachDraft
from app.state_machine import InvalidTransition, assert_transition
from app.tasks import dispatch_application_outbound

log = logging.getLogger(__name__)

router = APIRouter(prefix="/applications", tags=["applications"])


class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    job_title: str = Field(min_length=1, max_length=200)
    source_url: str | None = Field(default=None, max_length=1000)


class ApplicationOut(BaseModel):
    id: UUID
    company: str
    job_title: str
    source_url: str | None
    status: ApplicationStatus


class DraftOut(BaseModel):
    id: UUID
    application_id: UUID
    channel: str
    content: str
    status: str


class DraftBundleOut(BaseModel):
    application_id: UUID
    application_status: ApplicationStatus
    email: DraftOut
    linkedin: DraftOut


class InterviewPrepOut(BaseModel):
    themes: list[str]
    suggested_questions: list[str]
    talking_points: list[str]


class DraftPatch(BaseModel):
    content: str | None = Field(default=None, min_length=1)
    feedback_score: int | None = Field(default=None, ge=1, le=5)


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: DbDep, current_user: CurrentUserDep) -> list[ApplicationOut]:
    apps = db.scalars(select(Application).where(Application.user_id == current_user.id)).all()
    return [
        ApplicationOut(
            id=a.id,
            company=a.company,
            job_title=a.job_title,
            source_url=a.source_url,
            status=a.status,
        )
        for a in apps
    ]


@router.post("", response_model=ApplicationOut)
def create_application(
    payload: ApplicationCreate,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    app = Application(
        user_id=current_user.id,
        company=payload.company,
        job_title=payload.job_title,
        source_url=payload.source_url,
        status=ApplicationStatus.DISCOVERED,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return ApplicationOut(
        id=app.id,
        company=app.company,
        job_title=app.job_title,
        source_url=app.source_url,
        status=app.status,
    )


@router.post("/{application_id}/generate_draft", response_model=DraftBundleOut)
def generate_draft(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> DraftBundleOut:
    """Create email + LinkedIn drafts (status=DRAFT) and move application to PENDING_APPROVAL."""
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        assert_transition(app.status, ApplicationStatus.PENDING_APPROVAL)
    except InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    app.status = ApplicationStatus.PENDING_APPROVAL
    email_body, _em = generate_email_draft_content(db, app)
    li_body, _lm = generate_linkedin_draft_content(db, app)

    d_email = OutreachDraft(
        application_id=app.id,
        channel="email",
        content=email_body,
        status=DraftStatus.DRAFT,
    )
    d_li = OutreachDraft(
        application_id=app.id,
        channel="linkedin",
        content=li_body,
        status=DraftStatus.DRAFT,
    )
    db.add(d_email)
    db.add(d_li)
    db.commit()
    db.refresh(d_email)
    db.refresh(d_li)
    db.refresh(app)

    def _out(d: OutreachDraft) -> DraftOut:
        return DraftOut(
            id=d.id,
            application_id=d.application_id,
            channel=d.channel,
            content=d.content,
            status=d.status.value,
        )

    return DraftBundleOut(
        application_id=app.id,
        application_status=app.status,
        email=_out(d_email),
        linkedin=_out(d_li),
    )


@router.get("/drafts", response_model=list[DraftOut])
def list_drafts(db: DbDep, current_user: CurrentUserDep) -> list[DraftOut]:
    drafts = db.scalars(
        select(OutreachDraft)
        .join(Application, OutreachDraft.application_id == Application.id)
        .where(Application.user_id == current_user.id)
        .order_by(OutreachDraft.created_at.desc())
    ).all()
    return [
        DraftOut(
            id=d.id,
            application_id=d.application_id,
            channel=d.channel,
            content=d.content,
            status=d.status.value,
        )
        for d in drafts
    ]


@router.patch("/drafts/{draft_id}", response_model=DraftOut)
def patch_draft(
    draft_id: UUID,
    payload: DraftPatch,
    db: DbDep,
    current_user: CurrentUserDep,
) -> DraftOut:
    """Update draft text and persist optional human feedback to ``llm_logs``."""
    if payload.content is None and payload.feedback_score is None:
        raise HTTPException(status_code=400, detail="Provide content and/or feedback_score")

    d = db.get(OutreachDraft, draft_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Not found")
    app = db.get(Application, d.application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    prev = d.content
    if payload.content is not None:
        d.content = payload.content

    user_edit_val = payload.content if payload.content is not None else prev
    record_llm_interaction(
        db,
        user_id=current_user.id,
        agent_name="outreach_user_edit",
        prompt_parts=(str(d.id), d.channel, prev[:2000], user_edit_val[:8000]),
        raw_output=json.dumps(
            {"draft_id": str(d.id), "channel": d.channel, "previous_len": len(prev), "new_len": len(d.content)}
        ),
        latency_ms=None,
        user_edit=user_edit_val,
        feedback_score=payload.feedback_score,
    )
    db.commit()
    db.refresh(d)
    return DraftOut(
        id=d.id,
        application_id=d.application_id,
        channel=d.channel,
        content=d.content,
        status=d.status.value,
    )


@router.post("/{application_id}/interview_prep", response_model=InterviewPrepOut)
def interview_prep(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> InterviewPrepOut:
    """Interview prep with RAG-grounded résumé context plus job description when available."""
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    desc = load_job_description_for_application(db, app.source_url)

    full_resume = latest_resume_full_text(db, current_user.id)
    excerpt_fallback = latest_resume_excerpt_for_user(db, current_user.id)
    rag_text, rag_meta = retrieve_resume_context_for_role(
        resume_text=full_resume,
        company=app.company,
        job_title=app.job_title,
        job_description_excerpt=desc,
    )
    grounded = rag_text or excerpt_fallback
    rag_meta_json = json.dumps(rag_meta, sort_keys=True)

    data, _meta = generate_interview_prep_content(
        db,
        user_id=current_user.id,
        company=app.company,
        job_title=app.job_title,
        description_excerpt=desc,
        grounded_resume_context=grounded,
        rag_meta_json=rag_meta_json,
    )
    db.commit()
    return InterviewPrepOut(**data)


@router.post("/{application_id}/approve", response_model=ApplicationOut)
def approve(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        assert_transition(app.status, ApplicationStatus.APPROVED)
    except InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    app.status = ApplicationStatus.APPROVED
    db.commit()
    db.refresh(app)
    return ApplicationOut(
        id=app.id,
        company=app.company,
        job_title=app.job_title,
        source_url=app.source_url,
        status=app.status,
    )


@router.post("/{application_id}/reject", response_model=ApplicationOut)
def reject_application(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    """Mark the application as FAILED (human declined the draft)."""
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        assert_transition(app.status, ApplicationStatus.FAILED)
    except InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    app.status = ApplicationStatus.FAILED
    db.commit()
    db.refresh(app)
    return ApplicationOut(
        id=app.id,
        company=app.company,
        job_title=app.job_title,
        source_url=app.source_url,
        status=app.status,
    )


@router.post("/{application_id}/submit", response_model=ApplicationOut)
def submit(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        assert_transition(app.status, ApplicationStatus.SUBMITTED)
    except InvalidTransition as e:
        raise HTTPException(
            status_code=403, detail="Application must be APPROVED before submit"
        ) from e

    app.status = ApplicationStatus.SUBMITTED
    db.commit()
    db.refresh(app)
    try:
        dispatch_application_outbound.delay(str(app.id))
    except Exception as exc:  # noqa: BLE001
        log.warning("dispatch_application_outbound.delay failed (broker down?): %s", exc)
    return ApplicationOut(
        id=app.id,
        company=app.company,
        job_title=app.job_title,
        source_url=app.source_url,
        status=app.status,
    )
