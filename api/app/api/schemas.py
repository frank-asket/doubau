from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpsert(BaseModel):
    current_role: str | None = None
    years_experience: str | None = None
    persona: str | None = None
    location: str | None = None
    contact_preferences: str | None = None
    goals: dict | None = None
    plan_tier: str | None = None


class ProfileOut(ProfileUpsert):
    email: EmailStr


class WorkspaceSummaryOut(BaseModel):
    """Aggregates profile + pipeline counts for dashboard-style roadmap pages."""

    email: EmailStr
    persona: str | None = None
    current_role: str | None = None
    location: str | None = None
    plan_tier: str | None = None
    resume_status: str | None = None
    resume_id: str | None = None
    applications_total: int = 0
    applications_by_status: dict[str, int] = Field(default_factory=dict)
    pending_approval_count: int = 0


class JdFitRequest(BaseModel):
    """Paste a job description and compare to the latest parsed résumé (ATS-style)."""

    job_description: str = Field(min_length=20, max_length=50000)
    job_title: str | None = Field(default=None, max_length=220)
    company: str | None = Field(default=None, max_length=200)


class CheckInCreate(BaseModel):
    """Daily career health pulse — at least mood is required so streaks stay meaningful."""

    mood: int = Field(ge=1, le=5)
    energy: int | None = Field(default=None, ge=1, le=5)
    workload: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=4000)


class CheckInOut(BaseModel):
    id: UUID
    mood: int | None
    energy: int | None
    workload: int | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    status: str = Field(default="todo", max_length=40)
    due_date: date | None = None
    meta: dict = Field(default_factory=dict)


class MilestonePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, max_length=40)
    due_date: date | None = None
    meta: dict | None = None


class MilestoneOut(BaseModel):
    id: UUID
    title: str
    status: str
    due_date: date | None
    meta: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

