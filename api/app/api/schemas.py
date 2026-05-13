from datetime import date, datetime
from typing import Literal
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


class DashboardTrendPoint(BaseModel):
    label: str
    discovered: int = 0
    pending: int = 0
    submitted: int = 0
    failed: int = 0


class DashboardSummaryOut(WorkspaceSummaryOut):
    """Dashboard-specific aggregates with stable chart data."""

    resume_readiness: int = 0
    applications_trend: list[DashboardTrendPoint] = Field(default_factory=list)
    recent_applications: list[dict] = Field(default_factory=list)


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


class MilestoneCalendarCell(BaseModel):
    """One cell in a Monday-first month grid; ``day`` null means padding outside the month."""

    day: date | None = None
    milestones: list[MilestoneOut] = Field(default_factory=list)


class MilestoneCalendarOut(BaseModel):
    month: str
    weeks: list[list[MilestoneCalendarCell]]
    undated: list[MilestoneOut]


HeroTrend = Literal["up", "down", "flat"]
HeroGoalPhase = Literal["current", "next", "future"]


class HeroScoreMetricOut(BaseModel):
    value: int
    unit: str
    delta_percent: int
    trend: HeroTrend
    """Oldest → newest daily sample (14 points) for dashboard sparklines."""
    series_14d: list[int] = Field(..., min_length=14, max_length=14)


class HeroSubscriptionOut(BaseModel):
    show_upgrade_banner: bool
    plan_tier: str | None = None
    price_gbp_month: int = 18
    headline: str


class HeroTrendBucketOut(BaseModel):
    label: str
    awaiting_response: int = 0
    response_received: int = 0
    rejected: int = 0


class HeroApplicationTrendsOut(BaseModel):
    buckets: list[HeroTrendBucketOut]
    window_total: int
    window_delta_percent: int
    trend: HeroTrend


class HeroCareerGoalOut(BaseModel):
    phase: HeroGoalPhase
    title: str
    salary_label: str | None = None


class HeroTopPickOut(BaseModel):
    job_id: UUID
    title: str
    company: str
    seniority_caption: str
    employment_type: str | None = None
    workplace_caption: str
    salary_caption: str | None = None
    match_percent: int
    source_url: str | None = None


class HeroMetricsBundleOut(BaseModel):
    career_score: HeroScoreMetricOut
    skills_growth: HeroScoreMetricOut
    linkedin_health: HeroScoreMetricOut
    cv_score: HeroScoreMetricOut


class HeroDashboardOut(BaseModel):
    """Career-style home dashboard: scores, goals, application funnel chart, and feed picks."""

    display_name: str
    subscription: HeroSubscriptionOut
    metrics: HeroMetricsBundleOut
    career_goals: list[HeroCareerGoalOut]
    application_trends: HeroApplicationTrendsOut
    top_picks: list[HeroTopPickOut]
    algorithm_version: int = 1
