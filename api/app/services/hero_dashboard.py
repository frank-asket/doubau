"""
Career dashboard scoring for the hero-style home layout.

Scores use résumé parsing, profile completeness (including optional Google / LinkedIn OAuth
snapshots stored in ``profiles.goals``), application outcomes, and recent activity windows.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.application import Application, ApplicationStatus
from app.models.profile import Profile
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user_linkedin_token import UserLinkedInToken

Phase = Literal["current", "next", "future"]
Trend = Literal["up", "down", "flat"]


def display_name_from_email(email: str) -> str:
    local = (email or "").split("@", 1)[0].strip()
    if not local:
        return "there"
    parts = re.split(r"[._\-+]+", local)
    return (
        " ".join(p[:1].upper() + p[1:].lower() if p else "" for p in parts if p).strip() or "there"
    )


def _skills_from_parsed(parsed: dict[str, Any] | None) -> list[str]:
    if not parsed or not isinstance(parsed, dict):
        return []
    raw = parsed.get("skills")
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        s = str(item).strip()
        if s and s not in out:
            out.append(s)
    return out


def _resume_readiness_int(status: str | None) -> int:
    if status == ResumeStatus.EMBEDDED:
        return 100
    if status == ResumeStatus.PARSED:
        return 72
    if status == ResumeStatus.UPLOADED:
        return 40
    if status == ResumeStatus.FAILED:
        return 12
    return 0


def _linkedin_completeness(
    profile: Profile | None, *, resume_embedded: bool, has_linkedin_oidc: bool = False
) -> int:
    """0–100 checklist: profile fields, manual LinkedIn URL/headline, optional LinkedIn OpenID."""
    score = 0
    if profile:
        if (profile.current_role or "").strip():
            score += 24
        if (profile.location or "").strip():
            score += 18
        if (profile.years_experience or "").strip():
            score += 18
        if (profile.persona or "").strip():
            score += 12
        goals = profile.goals if isinstance(profile.goals, dict) else {}
        if isinstance(goals.get("linkedin_url"), str) and goals["linkedin_url"].strip():
            score += 14
        if isinstance(goals.get("headline"), str) and goals["headline"].strip():
            score += 14
    if resume_embedded:
        score += 12
    if has_linkedin_oidc:
        score += 18
    return min(100, score)


def _linkedin_oidc_connected(db: Session, *, user_id: Any, now_utc: datetime) -> bool:
    row = db.get(UserLinkedInToken, user_id)
    if row is None:
        return False
    if row.refresh_ciphertext and str(row.refresh_ciphertext).strip():
        return True
    if row.access_ciphertext and str(row.access_ciphertext).strip():
        exp = row.access_expires_at
        if exp is None:
            return True
        exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=UTC)
        return exp_aware > now_utc
    return False


def _momentum_from_counts(*, submitted: int, approved: int, pending: int) -> float:
    """0–100: recent pipeline motion (not quality of employer replies)."""
    return float(min(100, submitted * 14 + approved * 4 + pending * 2))


def _skills_norm(skill_count: int) -> float:
    return float(min(100, max(0, skill_count) * 7))


def _career_composite(*, cv: float, li: float, skills_n: float, momentum: float) -> int:
    raw = 0.30 * cv + 0.26 * li + 0.26 * skills_n + 0.18 * momentum
    return int(round(max(0.0, min(100.0, raw))))


def _trend_from_delta(delta: int) -> Trend:
    if delta > 1:
        return "up"
    if delta < -1:
        return "down"
    return "flat"


def _pct_change(current: float, previous: float) -> int:
    if previous <= 0:
        if current <= 0:
            return 0
        return 100
    return int(round((current - previous) / previous * 100))


def _outcome_rate(submitted: int, failed: int) -> float:
    denom = submitted + failed
    if denom <= 0:
        return 0.0
    return submitted / denom


def _classify_hero_outcome(
    status: ApplicationStatus,
) -> Literal["awaiting", "response", "rejected"]:
    if status == ApplicationStatus.SUBMITTED:
        return "response"
    if status in (ApplicationStatus.FAILED, ApplicationStatus.RETRY):
        return "rejected"
    return "awaiting"


def _trend_bucket(dt: datetime, *, start: datetime) -> int:
    naive = dt.replace(tzinfo=None) if dt.tzinfo else dt
    return max(0, min(7, int((naive - start).days // 4)))


@dataclass(frozen=True)
class WindowCounts:
    awaiting: int
    response: int
    rejected: int


def _count_applications_in_window(
    db: Session,
    *,
    user_id: Any,
    start: datetime,
    end: datetime,
) -> WindowCounts:
    rows = db.scalars(
        select(Application)
        .where(Application.user_id == user_id)
        .where(Application.created_at >= start)
        .where(Application.created_at < end)
    ).all()
    a = r = j = 0
    for app in rows:
        cat = _classify_hero_outcome(app.status)
        if cat == "awaiting":
            a += 1
        elif cat == "response":
            r += 1
        else:
            j += 1
    return WindowCounts(awaiting=a, response=r, rejected=j)


def _count_by_status_window(
    db: Session,
    *,
    user_id: Any,
    start: datetime,
    end: datetime,
) -> dict[str, int]:
    rows = db.execute(
        select(Application.status, func.count())
        .where(Application.user_id == user_id)
        .where(Application.created_at >= start)
        .where(Application.created_at < end)
        .group_by(Application.status)
    ).all()
    out: dict[str, int] = {}
    for st, n in rows:
        key = st.value if hasattr(st, "value") else str(st)
        out[key] = int(n)
    return out


def build_career_goals(profile: Profile | None) -> list[dict[str, Any]]:
    """Uses profile.goals['career_path'] when present; otherwise synthesizes three steps."""

    def _fmt_gbp(amount: Any) -> str | None:
        if amount is None:
            return None
        try:
            n = int(amount)
            return f"£{n:,}/year"
        except (TypeError, ValueError):
            return None

    role = ((profile.current_role if profile else None) or "Your role").strip() or "Your role"
    goals = profile.goals if profile and isinstance(profile.goals, dict) else {}
    path = goals.get("career_path")
    if isinstance(path, list) and path:
        out: list[dict[str, Any]] = []
        for i, row in enumerate(path[:5]):
            if not isinstance(row, dict):
                continue
            title = str(row.get("title") or "").strip() or f"Step {i + 1}"
            phase_raw = str(row.get("stage") or row.get("phase") or "").lower()
            if phase_raw in ("current", "now"):
                phase: Phase = "current"
            elif phase_raw in ("next", "target"):
                phase = "next"
            else:
                phase = "future"
            salary = row.get("salary_gbp")
            label = row.get("salary_label")
            sl = str(label).strip() if isinstance(label, str) else _fmt_gbp(salary)
            out.append({"phase": phase, "title": title, "salary_label": sl})
        if out:
            # Ensure we have up to three with phases current → next → future
            return out[:3]

    return [
        {
            "phase": "current",
            "title": role,
            "salary_label": _fmt_gbp(goals.get("current_salary_gbp")),
        },
        {
            "phase": "next",
            "title": f"Senior {role}"[:120],
            "salary_label": _fmt_gbp(goals.get("next_salary_gbp")),
        },
        {
            "phase": "future",
            "title": str(goals.get("future_title") or "Lead / Principal")[:120],
            "salary_label": _fmt_gbp(goals.get("future_salary_gbp")),
        },
    ]


def compute_hero_dashboard_payload(
    db: Session,
    *,
    user_id: Any,
    email: str,
    profile: Profile | None,
) -> dict[str, Any]:
    now = datetime.utcnow()
    now_utc = datetime.now(UTC)
    start_31 = now - timedelta(days=31)
    start_62 = now - timedelta(days=62)
    mid_31 = now - timedelta(days=31)

    labels = ["1-4", "5-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-31"]
    hero_trend = [
        {
            "label": lab,
            "awaiting_response": 0,
            "response_received": 0,
            "rejected": 0,
        }
        for lab in labels
    ]

    apps_31 = db.scalars(
        select(Application)
        .where(Application.user_id == user_id)
        .where(Application.created_at >= start_31)
        .order_by(Application.created_at.asc())
    ).all()
    for app in apps_31:
        created = app.created_at
        if created.tzinfo:
            created = created.replace(tzinfo=None)
        b = hero_trend[_trend_bucket(created, start=start_31)]
        cat = _classify_hero_outcome(app.status)
        if cat == "awaiting":
            b["awaiting_response"] += 1
        elif cat == "response":
            b["response_received"] += 1
        else:
            b["rejected"] += 1

    latest = db.scalar(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == user_id)
        .order_by(desc(ResumeDocument.created_at))
        .limit(1)
    )
    resume_status = latest.status if latest else None
    cv_score = _resume_readiness_int(resume_status)
    resume_embedded = resume_status == ResumeStatus.EMBEDDED

    parsed_list = db.scalars(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == user_id)
        .where(ResumeDocument.status.in_((ResumeStatus.PARSED, ResumeStatus.EMBEDDED)))
        .order_by(desc(ResumeDocument.created_at))
        .limit(5)
    ).all()

    current_skills = _skills_from_parsed(parsed_list[0].parsed_json if parsed_list else None)
    prior_doc: ResumeDocument | None = parsed_list[1] if len(parsed_list) > 1 else None

    prior_skills = _skills_from_parsed(prior_doc.parsed_json if prior_doc else None)
    skill_count = len(current_skills)
    prior_skill_count = len(prior_skills) if prior_doc else skill_count
    skills_delta_pct = (
        _pct_change(float(skill_count), float(max(1, prior_skill_count))) if prior_doc else 0
    )

    li_oidc = _linkedin_oidc_connected(db, user_id=user_id, now_utc=now_utc)
    li_score = _linkedin_completeness(
        profile, resume_embedded=resume_embedded, has_linkedin_oidc=li_oidc
    )

    recent_st = _count_by_status_window(db, user_id=user_id, start=start_31, end=now)
    prev_st = _count_by_status_window(db, user_id=user_id, start=start_62, end=mid_31)

    def _pick(d: dict[str, int], key: str) -> int:
        return int(d.get(key, 0))

    sub_r = _pick(recent_st, ApplicationStatus.SUBMITTED.value)
    sub_p = _pick(prev_st, ApplicationStatus.SUBMITTED.value)
    fail_r = _pick(recent_st, ApplicationStatus.FAILED.value) + _pick(
        recent_st, ApplicationStatus.RETRY.value
    )
    fail_p = _pick(prev_st, ApplicationStatus.FAILED.value) + _pick(
        prev_st, ApplicationStatus.RETRY.value
    )
    appr_r = _pick(recent_st, ApplicationStatus.APPROVED.value)
    appr_p = _pick(prev_st, ApplicationStatus.APPROVED.value)
    pend_r = (
        _pick(recent_st, ApplicationStatus.PENDING_APPROVAL.value)
        + _pick(recent_st, ApplicationStatus.DRAFTED.value)
        + _pick(recent_st, ApplicationStatus.DISCOVERED.value)
        + _pick(recent_st, ApplicationStatus.SCORING.value)
    )
    pend_p = (
        _pick(prev_st, ApplicationStatus.PENDING_APPROVAL.value)
        + _pick(prev_st, ApplicationStatus.DRAFTED.value)
        + _pick(prev_st, ApplicationStatus.DISCOVERED.value)
        + _pick(prev_st, ApplicationStatus.SCORING.value)
    )

    momentum_now = _momentum_from_counts(submitted=sub_r, approved=appr_r, pending=pend_r)
    momentum_prev = _momentum_from_counts(submitted=sub_p, approved=appr_p, pending=pend_p)
    skills_now_n = _skills_norm(skill_count)
    skills_prev_n = _skills_norm(prior_skill_count) if prior_doc else skills_now_n

    career_now = _career_composite(
        cv=float(cv_score),
        li=float(li_score),
        skills_n=skills_now_n,
        momentum=momentum_now,
    )
    career_prev = _career_composite(
        cv=float(cv_score),
        li=float(li_score),
        skills_n=skills_prev_n,
        momentum=momentum_prev,
    )
    career_delta_pct = _pct_change(float(career_now), float(max(1, career_prev)))

    rate_now = _outcome_rate(sub_r, fail_r)
    rate_prev = _outcome_rate(sub_p, fail_p)
    li_delta_pp = int(round((rate_now - rate_prev) * 100))

    cv_delta_pct = 0
    if prior_doc is not None:
        prev_cv = _resume_readiness_int(prior_doc.status)
        cv_delta_pct = _pct_change(float(cv_score), float(max(1, prev_cv)))

    plan_raw = (profile.plan_tier if profile else None) or ""
    tier = plan_raw.strip().lower()
    show_pro_banner = tier not in {"pro", "premium", "paid", "enterprise", "lifetime"}

    wc_now = _count_applications_in_window(db, user_id=user_id, start=start_31, end=now)
    wc_prev = _count_applications_in_window(db, user_id=user_id, start=start_62, end=mid_31)
    new_apps_recent = wc_now.awaiting + wc_now.response + wc_now.rejected
    new_apps_prev = wc_prev.awaiting + wc_prev.response + wc_prev.rejected
    apps_window_delta_pct = _pct_change(float(new_apps_recent), float(max(1, new_apps_prev)))

    return {
        "display_name": display_name_from_email(email),
        "subscription": {
            "show_upgrade_banner": show_pro_banner,
            "plan_tier": profile.plan_tier if profile else None,
            "price_gbp_month": 18,
            "headline": "Get unlimited access to all premium features for £18/month.",
        },
        "metrics": {
            "career_score": {
                "value": career_now,
                "unit": "points",
                "delta_percent": career_delta_pct,
                "trend": _trend_from_delta(career_delta_pct),
            },
            "skills_growth": {
                "value": skill_count,
                "unit": "on your CV",
                "delta_percent": skills_delta_pct,
                "trend": _trend_from_delta(skills_delta_pct),
            },
            "linkedin_health": {
                "value": li_score,
                "unit": "points",
                "delta_percent": li_delta_pp,
                "trend": _trend_from_delta(li_delta_pp),
            },
            "cv_score": {
                "value": cv_score,
                "unit": "points",
                "delta_percent": cv_delta_pct,
                "trend": _trend_from_delta(cv_delta_pct),
            },
        },
        "career_goals": build_career_goals(profile),
        "application_trends": {
            "buckets": hero_trend,
            "window_total": new_apps_recent,
            "window_delta_percent": apps_window_delta_pct,
            "trend": _trend_from_delta(apps_window_delta_pct),
        },
        "algorithm_version": 1,
    }
