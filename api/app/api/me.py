from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import desc, select

from app.api.deps import CurrentUserDep, DbDep
from app.api.schemas import ProfileOut, ProfileUpsert
from app.core.settings import settings
from app.models.profile import Profile
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.storage.s3 import ensure_bucket, s3_client
from app.tasks import process_resume_document

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(current_user: CurrentUserDep) -> ProfileOut:
    profile = current_user.profile
    return ProfileOut(
        email=current_user.email,
        current_role=profile.current_role if profile else None,
        years_experience=profile.years_experience if profile else None,
        persona=profile.persona if profile else None,
        location=profile.location if profile else None,
        contact_preferences=profile.contact_preferences if profile else None,
        goals=profile.goals if profile else None,
        plan_tier=profile.plan_tier if profile else None,
    )


@router.put("/profile", response_model=ProfileOut)
def put_profile(
    payload: ProfileUpsert,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ProfileOut:
    profile = current_user.profile
    if profile is None:
        profile = Profile(user_id=current_user.id, goals={})
        db.add(profile)

    if payload.current_role is not None:
        profile.current_role = payload.current_role
    if payload.years_experience is not None:
        profile.years_experience = payload.years_experience
    if payload.persona is not None:
        profile.persona = payload.persona
    if payload.location is not None:
        profile.location = payload.location
    if payload.contact_preferences is not None:
        profile.contact_preferences = payload.contact_preferences
    if payload.goals is not None:
        profile.goals = payload.goals
    if payload.plan_tier is not None:
        profile.plan_tier = payload.plan_tier

    db.commit()
    db.refresh(profile)

    return ProfileOut(
        email=current_user.email,
        current_role=profile.current_role,
        years_experience=profile.years_experience,
        persona=profile.persona,
        location=profile.location,
        contact_preferences=profile.contact_preferences,
        goals=profile.goals,
        plan_tier=profile.plan_tier,
    )


@router.post("/resume", response_model=dict)
async def upload_resume(
    db: DbDep,
    current_user: CurrentUserDep,
    file: UploadFile,
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content_type = file.content_type or ""
    allowed = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if content_type and content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    bucket = settings.s3_bucket_resumes
    prefix = settings.s3_resume_object_prefix
    key = f"{prefix}/{current_user.id}/{uuid4()}-{file.filename}"

    try:
        client = s3_client()
        ensure_bucket(client, bucket)
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=raw,
            ContentType=content_type or "application/octet-stream",
        )
    except (ClientError, BotoCoreError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    doc = ResumeDocument(
        user_id=current_user.id,
        status=ResumeStatus.UPLOADED,
        file_name=file.filename,
        content_type=content_type or None,
        size_bytes=len(raw),
        s3_bucket=bucket,
        s3_key=key,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    process_resume_document.delay(str(doc.id))
    return {
        "id": str(doc.id),
        "status": doc.status,
        "s3_bucket": doc.s3_bucket,
        "s3_key": doc.s3_key,
    }


@router.get("/resume/latest", response_model=dict)
def get_resume_latest(
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    """Most recently uploaded résumé for the current user (by `created_at`)."""
    doc = (
        db.execute(
            select(ResumeDocument)
            .where(ResumeDocument.user_id == current_user.id)
            .order_by(desc(ResumeDocument.created_at))
            .limit(1)
        )
        .scalars()
        .one_or_none()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="No resume uploaded yet")

    return {
        "id": str(doc.id),
        "status": doc.status,
        "file_name": doc.file_name,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "error": doc.error,
        "parsed_json": doc.parsed_json,
    }


@router.get("/resume/{resume_document_id}", response_model=dict)
def get_resume(
    resume_document_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    doc = (
        db.execute(
            select(ResumeDocument).where(
                ResumeDocument.id == resume_document_id,
                ResumeDocument.user_id == current_user.id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")

    return {
        "id": str(doc.id),
        "status": doc.status,
        "file_name": doc.file_name,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "error": doc.error,
        "parsed_json": doc.parsed_json,
    }

