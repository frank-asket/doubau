from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentUserDep, DbDep
from app.models.application import Application, ApplicationStatus
from app.models.outreach_draft import OutreachDraft
from app.state_machine import InvalidTransition, assert_transition

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


@router.post("/{application_id}/generate_draft", response_model=DraftOut)
def generate_draft(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> DraftOut:
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        assert_transition(app.status, ApplicationStatus.PENDING_APPROVAL)
    except InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    app.status = ApplicationStatus.PENDING_APPROVAL
    draft = OutreachDraft(
        application_id=app.id,
        channel="email",
        content=f"Hi there — I’m interested in the {app.job_title} role at {app.company}.",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return DraftOut(
        id=draft.id,
        application_id=draft.application_id,
        channel=draft.channel,
        content=draft.content,
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
        DraftOut(id=d.id, application_id=d.application_id, channel=d.channel, content=d.content)
        for d in drafts
    ]


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
        # Keep the hard security semantics: submit is forbidden unless APPROVED.
        raise HTTPException(status_code=403, detail="Application must be APPROVED before submit") from e

    app.status = ApplicationStatus.SUBMITTED
    db.commit()
    db.refresh(app)
    return ApplicationOut(
        id=app.id,
        company=app.company,
        job_title=app.job_title,
        source_url=app.source_url,
        status=app.status,
    )

