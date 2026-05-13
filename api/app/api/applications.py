import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select

from app.agents.interview_rag import (
    load_job_description_for_application,
    retrieve_resume_context_for_role,
)
from app.agents.outreach import (
    generate_email_draft_content,
    generate_interview_prep_content,
    generate_linkedin_draft_content,
    latest_resume_excerpt_for_user,
    latest_resume_full_text,
)
from app.api.deps import CurrentUserDep, DbDep, user_from_token_payload
from app.db import SessionLocal
from app.integrations.gmail_oauth import google_oauth_configured, send_plaintext_email
from app.llm.logging import record_llm_interaction
from app.models.application import Application, ApplicationStatus
from app.models.outreach_draft import DraftStatus, OutreachDraft
from app.models.user_google_token import UserGoogleToken
from app.security import decode_any_access_token
from app.state_machine import InvalidTransition, assert_transition
from app.tasks import dispatch_application_outbound

log = logging.getLogger(__name__)

router = APIRouter(prefix="/applications", tags=["applications"])


def _pipeline_signature(db, user_id: UUID) -> str:
    """Stable string over applications + drafts so WS clients detect approve/edit/reject/patch."""
    apps = db.scalars(
        select(Application).where(Application.user_id == user_id).order_by(Application.id)
    ).all()
    drafts = db.scalars(
        select(OutreachDraft)
        .join(Application, OutreachDraft.application_id == Application.id)
        .where(Application.user_id == user_id)
        .order_by(OutreachDraft.id)
    ).all()
    parts: list[str] = [
        f"a:{a.id}:{a.status.value}:{a.updated_at.isoformat()}:{a.submitted_at.isoformat() if a.submitted_at else ''}"
        for a in apps
    ]
    parts.extend(f"d:{d.id}:{d.status.value}:{len(d.content)}" for d in drafts)
    return "|".join(parts)


class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    job_title: str = Field(min_length=1, max_length=200)
    source_url: str | None = Field(default=None, max_length=1000)


class ApplicationOut(BaseModel):
    id: UUID
    company: str
    job_title: str
    source_url: str | None
    recipient_email: str | None
    gmail_sent_message_id: str | None
    submitted_at: datetime | None
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime


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


class SendGmailInAppIn(BaseModel):
    recipient_email: EmailStr
    subject: str | None = Field(default=None, max_length=220)


def _touch_application(app: Application) -> None:
    app.updated_at = datetime.utcnow()


def _send_submission_receipt_email(
    *,
    refresh_token_cipher: str,
    from_addr: str,
    application_id: UUID,
    company: str,
    job_title: str,
    recipient_email: str,
    outgoing_subject: str,
    submitted_at: datetime,
) -> None:
    """Separate message to the job seeker only — does not affect employer thread."""
    at = submitted_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    body = (
        "This is your Doubow acknowledgement of receipt.\n\n"
        f"Role: {job_title}\n"
        f"Company: {company}\n"
        f"Sent to (employer): {recipient_email}\n"
        f"Your application email subject: {outgoing_subject}\n"
        f"Recorded at: {at}\n\n"
        f"The application message was sent from {from_addr} through Doubow. "
        "Open Gmail → Sent to see the exact email to the employer.\n\n"
        f"Reference ID (support): {application_id}\n"
    )
    send_plaintext_email(
        refresh_token_cipher=refresh_token_cipher,
        from_addr=from_addr,
        to_addr=from_addr,
        subject=f"[Doubow] Receipt: {job_title} · {company}",
        body=body,
    )


def _application_out(app: Application) -> ApplicationOut:
    return ApplicationOut(
        id=app.id,
        company=app.company,
        job_title=app.job_title,
        source_url=app.source_url,
        recipient_email=app.recipient_email,
        gmail_sent_message_id=app.gmail_sent_message_id,
        submitted_at=app.submitted_at,
        status=app.status,
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


def _draft_out(draft: OutreachDraft) -> DraftOut:
    return DraftOut(
        id=draft.id,
        application_id=draft.application_id,
        channel=draft.channel,
        content=draft.content,
        status=draft.status.value,
    )


def _application_has_active_draft(db, application_id: UUID) -> bool:
    return (
        db.scalar(
            select(OutreachDraft.id)
            .where(
                OutreachDraft.application_id == application_id,
                OutreachDraft.status == DraftStatus.DRAFT,
            )
            .limit(1)
        )
        is not None
    )


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: DbDep, current_user: CurrentUserDep) -> list[ApplicationOut]:
    apps = db.scalars(
        select(Application)
        .where(Application.user_id == current_user.id)
        .order_by(Application.updated_at.desc(), Application.created_at.desc())
    ).all()
    return [_application_out(a) for a in apps]


@router.post("", response_model=ApplicationOut)
def create_application(
    payload: ApplicationCreate,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    existing_stmt = select(Application).where(Application.user_id == current_user.id)
    if payload.source_url:
        existing_stmt = existing_stmt.where(Application.source_url == payload.source_url)
    else:
        existing_stmt = existing_stmt.where(
            func.lower(Application.company) == payload.company.strip().lower(),
            func.lower(Application.job_title) == payload.job_title.strip().lower(),
        )
    existing = db.scalar(existing_stmt.order_by(Application.created_at.desc()).limit(1))
    if existing is not None:
        return _application_out(existing)

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
    return _application_out(app)


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

    if app.status != ApplicationStatus.PENDING_APPROVAL:
        try:
            assert_transition(app.status, ApplicationStatus.PENDING_APPROVAL)
        except InvalidTransition as e:
            if app.status == ApplicationStatus.SUBMITTED:
                raise HTTPException(
                    status_code=409,
                    detail="This application is already submitted. You cannot regenerate outreach drafts for it from this flow.",
                ) from e
            raise HTTPException(status_code=409, detail=str(e)) from e

    app.status = ApplicationStatus.PENDING_APPROVAL
    _touch_application(app)
    email_body, _em = generate_email_draft_content(db, app)
    li_body, _lm = generate_linkedin_draft_content(db, app)

    existing = db.scalars(
        select(OutreachDraft).where(OutreachDraft.application_id == app.id)
    ).all()
    for draft in existing:
        db.delete(draft)

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

    return DraftBundleOut(
        application_id=app.id,
        application_status=app.status,
        email=_draft_out(d_email),
        linkedin=_draft_out(d_li),
    )


@router.get("/drafts", response_model=list[DraftOut])
def list_drafts(db: DbDep, current_user: CurrentUserDep) -> list[DraftOut]:
    drafts = db.scalars(
        select(OutreachDraft)
        .join(Application, OutreachDraft.application_id == Application.id)
        .where(Application.user_id == current_user.id)
        .order_by(OutreachDraft.created_at.desc())
    ).all()
    return [_draft_out(d) for d in drafts]


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
        if app.status in (ApplicationStatus.SUBMITTED, ApplicationStatus.FAILED):
            raise HTTPException(
                status_code=409,
                detail="Submitted or closed applications cannot be edited.",
            )
        d.content = payload.content
        app.status = ApplicationStatus.PENDING_APPROVAL
        _touch_application(app)

    user_edit_val = payload.content if payload.content is not None else prev
    record_llm_interaction(
        db,
        user_id=current_user.id,
        agent_name="outreach_user_edit",
        prompt_parts=(str(d.id), d.channel, prev[:2000], user_edit_val[:8000]),
        raw_output=json.dumps(
            {
                "draft_id": str(d.id),
                "channel": d.channel,
                "previous_len": len(prev),
                "new_len": len(d.content),
            }
        ),
        latency_ms=None,
        user_edit=user_edit_val,
        feedback_score=payload.feedback_score,
    )
    db.commit()
    db.refresh(d)
    return _draft_out(d)


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
    if not _application_has_active_draft(db, application_id):
        raise HTTPException(status_code=409, detail="Generate an outreach draft before approval.")

    app.status = ApplicationStatus.APPROVED
    _touch_application(app)
    db.commit()
    db.refresh(app)
    return _application_out(app)


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
    _touch_application(app)
    db.commit()
    db.refresh(app)
    return _application_out(app)


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
    if not _application_has_active_draft(db, application_id):
        raise HTTPException(status_code=409, detail="No approved outreach draft found.")

    app.status = ApplicationStatus.SUBMITTED
    app.submitted_at = datetime.now(timezone.utc)
    _touch_application(app)
    db.commit()
    db.refresh(app)
    try:
        dispatch_application_outbound.delay(str(app.id))
    except Exception as exc:  # noqa: BLE001
        log.warning("dispatch_application_outbound.delay failed (broker down?): %s", exc)
    return _application_out(app)


@router.post("/{application_id}/send-gmail-in-app", response_model=ApplicationOut)
def send_gmail_in_app(
    application_id: UUID,
    payload: SendGmailInAppIn,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    """Send approved email draft via user's Gmail (OAuth). Closes LinkedIn draft in-app."""
    if not google_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail in-app send not configured (set DOUBOW_GOOGLE_OAUTH_* on API).",
        )

    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if app.status != ApplicationStatus.APPROVED:
        raise HTTPException(
            status_code=409,
            detail="Application must be APPROVED before in-app Gmail send.",
        )

    g = db.get(UserGoogleToken, current_user.id)
    if g is None or not g.refresh_ciphertext:
        raise HTTPException(
            status_code=400,
            detail="Connect Gmail under Settings before sending from your mailbox.",
        )
    from_addr = (g.google_account_email or "").strip()
    if not from_addr:
        raise HTTPException(
            status_code=400,
            detail="Reconnect Gmail — we could not read your Google account email.",
        )

    email_draft = db.scalar(
        select(OutreachDraft).where(
            OutreachDraft.application_id == application_id,
            OutreachDraft.channel == "email",
            OutreachDraft.status == DraftStatus.DRAFT,
        )
    )
    if email_draft is None:
        raise HTTPException(status_code=409, detail="No email draft ready to send.")

    subj = (payload.subject or "").strip() or f"Application — {app.job_title} ({app.company})"
    to_addr = str(payload.recipient_email).strip()

    bcc_addrs: tuple[str, ...] = ()
    if from_addr.lower() != to_addr.lower():
        bcc_addrs = (from_addr,)

    t0 = time.perf_counter()
    try:
        sent_resp = send_plaintext_email(
            refresh_token_cipher=g.refresh_ciphertext,
            from_addr=from_addr,
            to_addr=to_addr,
            subject=subj,
            body=email_draft.content,
            bcc_addrs=bcc_addrs or None,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gmail send failed: {e!s}") from e
    ms = int((time.perf_counter() - t0) * 1000)

    gmail_mid: str | None = None
    if isinstance(sent_resp, dict):
        mid_raw = sent_resp.get("id")
        if isinstance(mid_raw, str) and mid_raw.strip():
            gmail_mid = mid_raw.strip()[:255]

    record_llm_interaction(
        db,
        user_id=current_user.id,
        agent_name="sender_email",
        prompt_parts=(str(application_id), str(email_draft.id), subj, "gmail_api"),
        raw_output=json.dumps(
            {
                "channel": "email",
                "to": to_addr,
                "sent": True,
                "via": "gmail_api",
                "gmail_message_id": gmail_mid,
                "bcc_self": bool(bcc_addrs),
            },
        ),
        latency_ms=ms,
    )
    email_draft.status = DraftStatus.SENT
    app.recipient_email = to_addr
    app.gmail_sent_message_id = gmail_mid

    li_draft = db.scalar(
        select(OutreachDraft).where(
            OutreachDraft.application_id == application_id,
            OutreachDraft.channel == "linkedin",
            OutreachDraft.status == DraftStatus.DRAFT,
        )
    )
    if li_draft is not None:
        record_llm_interaction(
            db,
            user_id=current_user.id,
            agent_name="sender_linkedin",
            prompt_parts=(str(application_id), str(li_draft.id), "skipped_with_gmail_send"),
            raw_output=json.dumps(
                {"sent": True, "channel": "linkedin", "mode": "closed_in_app_with_email_apply"}
            ),
            latency_ms=0,
        )
        li_draft.status = DraftStatus.SENT

    try:
        assert_transition(app.status, ApplicationStatus.SUBMITTED)
    except InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    submitted_at = datetime.now(timezone.utc)
    app.status = ApplicationStatus.SUBMITTED
    app.submitted_at = submitted_at
    _touch_application(app)
    db.commit()
    db.refresh(app)

    try:
        _send_submission_receipt_email(
            refresh_token_cipher=g.refresh_ciphertext,
            from_addr=from_addr,
            application_id=app.id,
            company=app.company,
            job_title=app.job_title,
            recipient_email=to_addr,
            outgoing_subject=subj,
            submitted_at=submitted_at,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("submission receipt email failed (application already saved): %s", exc)

    return _application_out(app)


@router.post("/{application_id}/skip-linkedin-draft", response_model=ApplicationOut)
def skip_linkedin_draft(
    application_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ApplicationOut:
    """Mark LinkedIn draft done without LinkedIn API (email-only or manual DM)."""
    app = db.get(Application, application_id)
    if app is None or app.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if app.status != ApplicationStatus.APPROVED:
        raise HTTPException(
            status_code=409,
            detail="Only APPROVED applications can skip the LinkedIn draft here.",
        )

    li_draft = db.scalar(
        select(OutreachDraft).where(
            OutreachDraft.application_id == application_id,
            OutreachDraft.channel == "linkedin",
            OutreachDraft.status == DraftStatus.DRAFT,
        )
    )
    if li_draft is None:
        raise HTTPException(status_code=409, detail="No active LinkedIn draft to skip.")

    t0 = time.perf_counter()
    record_llm_interaction(
        db,
        user_id=current_user.id,
        agent_name="sender_linkedin",
        prompt_parts=(str(application_id), str(li_draft.id), "skipped_in_app"),
        raw_output=json.dumps({"sent": True, "channel": "linkedin", "mode": "user_skipped_in_app"}),
        latency_ms=int((time.perf_counter() - t0) * 1000),
    )
    li_draft.status = DraftStatus.SENT
    _touch_application(app)
    db.commit()
    db.refresh(app)
    return _application_out(app)


@router.websocket("/ws")
async def applications_ws(websocket: WebSocket) -> None:
    """Push notifications when pipeline state changes (approve, reject, draft edit, generate).

    Clients subscribe with the same Clerk JWT as REST (`token` or `access_token` query param).
    Server compares a snapshot signature every ~2s and emits ``applications_changed`` when it
    differs.
    """
    await websocket.accept()
    token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = await decode_any_access_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    with SessionLocal() as db:
        try:
            user = user_from_token_payload(db, payload)
        except HTTPException:
            await websocket.close(code=4401)
            return
        uid = user.id
        initial = _pipeline_signature(db, uid)

    await websocket.send_json({"type": "connected", "version": initial})
    last_sig = initial

    try:
        while True:
            await asyncio.sleep(2.0)
            with SessionLocal() as db:
                try:
                    user_from_token_payload(db, payload)
                except HTTPException:
                    await websocket.close(code=4401)
                    return
                sig = _pipeline_signature(db, uid)
            if sig != last_sig:
                last_sig = sig
                await websocket.send_json({"type": "applications_changed", "version": sig})
    except WebSocketDisconnect:
        log.debug("applications_ws disconnected")
