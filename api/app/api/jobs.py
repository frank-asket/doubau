from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select

from app.api.deps import CurrentUserDep, DbDep
from app.models.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=220)
    location: str | None = Field(default=None, max_length=220)
    seniority: str | None = Field(default=None, max_length=80)
    employment_type: str | None = Field(default=None, max_length=80)
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_url: str | None = Field(default=None, max_length=1000)


class JobOut(BaseModel):
    id: UUID
    company: str
    title: str
    location: str | None
    seniority: str | None
    employment_type: str | None
    description: str | None
    tags: list[str]
    source_url: str | None


def _job_out(j: Job) -> JobOut:
    return JobOut(
        id=j.id,
        company=j.company,
        title=j.title,
        location=j.location,
        seniority=j.seniority,
        employment_type=j.employment_type,
        description=j.description,
        tags=j.tags or [],
        source_url=j.source_url,
    )


@router.post("", response_model=JobOut)
def create_job(payload: JobCreate, db: DbDep, _: CurrentUserDep) -> JobOut:
    job = Job(
        company=payload.company,
        title=payload.title,
        location=payload.location,
        seniority=payload.seniority,
        employment_type=payload.employment_type,
        description=payload.description,
        tags=payload.tags,
        source_url=payload.source_url,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_out(job)


@router.get("", response_model=list[JobOut])
def list_jobs(
    db: DbDep,
    _: CurrentUserDep,
    q: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[JobOut]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    stmt = select(Job)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Job.title).like(like),
                func.lower(Job.company).like(like),
                func.lower(func.coalesce(Job.location, "")).like(like),
            )
        )

    jobs = db.scalars(stmt.order_by(desc(Job.created_at)).limit(limit).offset(offset)).all()
    return [_job_out(j) for j in jobs]


class FeedOut(BaseModel):
    job: JobOut
    score: float


def _score_job(*, job: Job, persona: str | None, focus: list[str]) -> float:
    tags = {t.lower() for t in (job.tags or [])}
    title = (job.title or "").lower()
    seniority = (job.seniority or "").lower()

    score = 0.0

    # Persona heuristics
    if persona == "student":
        if "intern" in tags or "intern" in title:
            score += 3.0
        if "graduate" in tags or "graduate" in title or "new grad" in title:
            score += 2.0
        if "junior" in seniority or "junior" in title:
            score += 1.0
    elif persona == "career_switcher":
        if "entry" in seniority or "junior" in seniority:
            score += 1.0
    elif persona == "employed_exploring":
        score += 0.25
    elif persona == "active_search":
        score += 0.5

    # Focus heuristics
    if "find_jobs" in focus:
        score += 0.5

    # Recency nudge: handled in ordering separately; keep score mostly about relevance.
    return score


@router.get("/feed", response_model=list[FeedOut])
def feed(
    db: DbDep,
    current_user: CurrentUserDep,
    limit: int = 30,
    offset: int = 0,
) -> list[FeedOut]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    profile = current_user.profile
    persona = profile.persona if profile else None
    focus = []
    if profile and isinstance(profile.goals, dict):
        maybe = profile.goals.get("focus")
        if isinstance(maybe, list) and all(isinstance(x, str) for x in maybe):
            focus = maybe

    jobs = db.scalars(select(Job).order_by(desc(Job.created_at)).limit(500)).all()
    scored = [
        FeedOut(job=_job_out(j), score=_score_job(job=j, persona=persona, focus=focus))
        for j in jobs
    ]
    scored.sort(key=lambda x: (x.score, x.job.company, x.job.title), reverse=True)

    return scored[offset : offset + limit]

