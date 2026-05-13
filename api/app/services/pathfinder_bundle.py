"""Deterministic career path cards — mirrors ``web/src/lib/career-data.ts`` heuristics (no ML)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.schemas import CareerPathCardOut, PathfinderBundleOut, PathfinderCta, PathfinderWizardStateOut
from app.models.application import Application, ApplicationStatus
from app.models.profile import Profile
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user import User

GOAL_LABELS: dict[str, str] = {
    "improve_cv": "Improve CV",
    "find_jobs": "Find jobs",
    "interview_prep": "Interview prep",
    "get_promoted": "Get promoted",
    "boost_linkedin": "Boost LinkedIn",
}


def _label_for_goal_id(goal_id: str) -> str:
    return GOAL_LABELS.get(goal_id, goal_id.replace("_", " "))


def _goal_focus_ids(goals: dict | None) -> list[str]:
    if not goals or not isinstance(goals, dict):
        return []
    raw = goals.get("focus")
    if not isinstance(raw, list):
        return []
    return [str(x) for x in raw if isinstance(x, str) and x.strip()]


def _get_resume_structured(parsed_json: dict | None) -> dict[str, Any] | None:
    if not parsed_json or not isinstance(parsed_json, dict):
        return None
    llm = parsed_json.get("structured_llm")
    if isinstance(llm, dict):
        return llm
    st = parsed_json.get("structured")
    if isinstance(st, dict):
        return st
    return None


def _resume_skills(structured: dict[str, Any] | None) -> list[str]:
    if not structured:
        return []
    skills = structured.get("skills")
    if not isinstance(skills, list):
        return []
    out = [str(s) for s in skills if isinstance(s, str) and s.strip()]
    return out[:24]


def _readiness_percent(resume_status: str | None) -> int:
    s = (resume_status or "").upper()
    if s == ResumeStatus.EMBEDDED:
        return 100
    if s == ResumeStatus.PARSED:
        return 72
    if s == ResumeStatus.UPLOADED:
        return 40
    if s == ResumeStatus.FAILED:
        return 12
    return 0


def _linkedin_style_scores(structured: dict[str, Any] | None, extracted_fallback: str | None) -> dict[str, int]:
    headline = ""
    summary = ""
    if structured:
        if isinstance(structured.get("headline"), str):
            headline = structured["headline"].strip()
        if isinstance(structured.get("summary"), str):
            summary = structured["summary"].strip()
    exp = structured.get("experience") if structured else None
    exp_list = exp if isinstance(exp, list) else []
    edu = structured.get("education") if structured else None
    edu_list = edu if isinstance(edu, list) else []

    def score_headline() -> int:
        h = headline
        if not h and extracted_fallback:
            first = extracted_fallback.split("\n")[0]
            h = first.strip() if first else ""
        if not h:
            return 2
        ln = len(h)
        if 35 <= ln <= 220:
            return 8
        if ln >= 20:
            return 6
        return 4

    def score_summary() -> int:
        if not summary:
            return 3
        ln = len(summary)
        if ln >= 320:
            return 9
        if ln >= 160:
            return 7
        if ln >= 80:
            return 5
        return 4

    def score_exp() -> int:
        bullets = 0
        for row in exp_list:
            if not isinstance(row, dict):
                continue
            b = row.get("bullets")
            if isinstance(b, list):
                bullets += len([x for x in b if isinstance(x, str) and x.strip()])
        if bullets >= 8:
            return 9
        if bullets >= 4:
            return 7
        if bullets >= 1:
            return 5
        return 3

    def score_edu() -> int:
        if len(edu_list) >= 2:
            return 8
        if len(edu_list) == 1:
            return 6
        return 4

    def score_other() -> int:
        skills = _resume_skills(structured)
        links = structured.get("links") if structured else None
        link_list = links if isinstance(links, list) else []
        link_n = len([x for x in link_list if isinstance(x, str)])
        raw = len(skills) + link_n * 2
        if raw >= 10:
            return 8
        if raw >= 5:
            return 6
        if raw >= 1:
            return 5
        return 4

    return {
        "headline": score_headline(),
        "summary": score_summary(),
        "experience": score_exp(),
        "education": score_edu(),
        "other": score_other(),
    }


def _overall_profile_score(scores: dict[str, int]) -> int:
    vals = list(scores.values())
    return int(round(sum(vals) / len(vals)) * 10)


def _persona_label(persona: str | None) -> str:
    if not persona:
        return "—"
    p = persona.lower()
    if p == "student":
        return "Student / recent graduate"
    if p == "employed_exploring":
        return "Employed, exploring"
    if p == "active_search":
        return "Actively job searching"
    if p == "career_switcher":
        return "Career switcher"
    return persona.replace("_", " ")


def _clamp_match(n: float) -> int:
    return int(min(96, max(38, round(n))))


def _goal_required_skills(goal_id: str) -> list[str]:
    if goal_id == "interview_prep":
        return ["Structured stories", "Role-specific practice", "Feedback loop"]
    if goal_id == "find_jobs":
        return ["Market mapping", "Tailored CV bullets", "Outbound sequencing"]
    if goal_id == "improve_cv":
        return ["ATS-ready layout", "Quantified wins", "Keyword alignment"]
    if goal_id == "boost_linkedin":
        return ["Headline clarity", "Featured proof points", "Consistent narrative"]
    if goal_id == "get_promoted":
        return ["Stakeholder visibility", "Impact metrics", "Prioritisation"]
    return ["Clarity on outcomes", "Evidence of impact", "Consistent narrative"]


def _wizard_boost(path_id: str, w: dict[str, str]) -> int:
    b = 0
    ns = w.get("northStar")
    if ns == "new_company" and ("find_jobs" in path_id or path_id == "pipeline-momentum"):
        b += 5
    if ns == "promotion" and ("get_promoted" in path_id or "boost_linkedin" in path_id):
        b += 5
    if ns == "pivot" and ("improve_cv" in path_id or path_id == "archetype-pivot"):
        b += 5
    if ns == "ic_depth" and "improve_cv" in path_id:
        b += 4
    if ns == "leadership" and ("get_promoted" in path_id or "interview_prep" in path_id):
        b += 4
    if ns == "exploring" and path_id == "foundation-clarify":
        b += 3

    c = w.get("constraint")
    if c == "time" and "find_jobs" in path_id:
        b += 2
    if c == "visa" and "find_jobs" in path_id:
        b += 3
    if c == "confidence" and "interview_prep" in path_id:
        b += 4

    cap = w.get("weeklyCapacity")
    if cap == "high" and path_id == "pipeline-momentum":
        b += 3
    if cap == "low" and ("improve_cv" in path_id or "linkedin" in path_id):
        b += 2

    p = w.get("proof")
    if p == "metrics" and "get_promoted" in path_id:
        b += 3
    if p == "shipping" and "find_jobs" in path_id:
        b += 3
    if p == "people" and "boost_linkedin" in path_id:
        b += 3

    r = w.get("risk")
    if r == "high" and "find_jobs" in path_id:
        b += 2
    if r == "low" and ("interview_prep" in path_id or "improve_cv" in path_id):
        b += 2
    return b


def _timeframe_for(path_id: str, weekly: str | None) -> str:
    base = "3–6 wks"
    if weekly == "low":
        base = "4–8 wks"
    elif weekly == "high":
        base = "2–4 wks"
    if "interview_prep" in path_id:
        return "1–3 wks"
    if path_id == "foundation-clarify":
        return "3–5 days"
    if path_id == "pipeline-momentum":
        return "ongoing"
    return base


def _cta(label: str, href: str) -> PathfinderCta:
    return PathfinderCta(label=label, href=href)


def _workspace_counts(db: Session, user_id: UUID) -> tuple[int, dict[str, int], int]:
    rows = db.execute(
        select(Application.status, func.count()).where(Application.user_id == user_id).group_by(Application.status)
    ).all()
    by_status: dict[str, int] = {}
    total = 0
    for st, n in rows:
        key = st.value if hasattr(st, "value") else str(st)
        by_status[key] = int(n)
        total += int(n)
    pending = db.scalar(
        select(func.count())
        .select_from(Application)
        .where(Application.user_id == user_id)
        .where(Application.status == ApplicationStatus.PENDING_APPROVAL)
    )
    return total, by_status, int(pending or 0)


def build_path_cards(
    *,
    profile: Profile | None,
    goals: dict | None,
    resume_status: str | None,
    structured: dict[str, Any] | None,
    extracted_text: str | None,
    persona_ws: str | None,
    applications_total: int,
    applications_by_status: dict[str, int],
    pending_approval_count: int,
    wizard_answers: dict[str, str],
) -> list[CareerPathCardOut]:
    role = (profile.current_role if profile and profile.current_role else "").strip() or "your target role"
    loc = (profile.location if profile and profile.location else "").strip() or "your location"
    exp = (profile.years_experience if profile and profile.years_experience else "").strip() or "Experience not set"
    persona_raw = (persona_ws or (profile.persona if profile else None) or "").strip()
    persona = persona_raw.lower()
    skills = _resume_skills(structured)
    transfer = skills[:5]
    transfer_out = transfer if transfer else ["Problem solving", "Collaboration", "Delivery"]
    readiness = _readiness_percent(resume_status)
    scores = _linkedin_style_scores(structured, (extracted_text or "").strip() or None)
    profile_signal = _overall_profile_score(scores) if structured else None
    base_meta = [loc, exp, f"{readiness}% résumé readiness"]
    if profile_signal is not None:
        base_meta.append(f"{profile_signal}/100 profile signal")

    submitted = int(applications_by_status.get("SUBMITTED", 0) or 0)
    focus_ids = _goal_focus_ids(goals)
    paths: list[CareerPathCardOut] = []

    def push(card: CareerPathCardOut) -> None:
        boost = _wizard_boost(card.id, wizard_answers)
        paths.append(card.model_copy(update={"match": _clamp_match(card.match + boost)}))

    if not focus_ids:
        push(
            CareerPathCardOut(
                id="foundation-clarify",
                title="Clarify your goals",
                subtitle="Unlock sharper discovery and CV work",
                body=f"Add goal focus in Settings so Doubow can prioritise discovery, CV iterations, and milestones around {role}.",
                meta=base_meta,
                match=58 + readiness / 6 + (profile_signal / 25 if profile_signal else 0),
                timeframe=_timeframe_for("foundation-clarify", wizard_answers.get("weeklyCapacity")),
                required=transfer_out[:3],
                transferable=transfer_out,
                primary_cta=_cta("Set goals", "/app/settings"),
                secondary_cta=_cta("Career profile", "/app/career-profile"),
            )
        )
    else:
        for index, gid in enumerate(focus_ids):
            label = _label_for_goal_id(gid)
            pid = f"goal-{gid}"
            primary = _cta("Open Planner", "/app/planner")
            secondary = _cta("Career steps", "/app/career-steps")
            if gid == "find_jobs":
                primary = _cta("Open Discovery", "/app/discovery")
            elif gid == "interview_prep":
                primary = _cta("Interview prep", "/app/interview-prep")
            push(
                CareerPathCardOut(
                    id=pid,
                    title=f"{label} track",
                    subtitle=f"Goal-led plan for {role}",
                    body=f'Aligned with "{label}" while you position as {role}. Combine Discovery, CV updates, and milestones — wizard answers tune how aggressive this path reads.',
                    meta=base_meta,
                    match=56 + index * 4 + readiness / 8 + (profile_signal / 30 if profile_signal else 0),
                    timeframe=_timeframe_for(pid, wizard_answers.get("weeklyCapacity")),
                    required=_goal_required_skills(gid),
                    transferable=transfer_out,
                    primary_cta=primary,
                    secondary_cta=secondary,
                )
            )

    if persona == "career_switcher" or wizard_answers.get("northStar") == "pivot":
        extra = f"Persona: {_persona_label(persona_raw)}" if persona_raw else "Persona unset"
        push(
            CareerPathCardOut(
                id="archetype-pivot",
                title="Credibility bridge",
                subtitle="Reframe past wins for a new lane",
                body=f"Package transferable proof so hiring managers see continuity into {role}, not just domain change.",
                meta=[*base_meta, extra],
                match=62 + readiness / 10,
                timeframe=_timeframe_for("archetype-pivot", wizard_answers.get("weeklyCapacity")),
                required=["One-page narrative", "Two proof stories", "Keyword bridge table"],
                transferable=transfer_out,
                primary_cta=_cta("CV builder", "/app/cv-builder"),
                secondary_cta=_cta("Skill gap", "/app/skill-gap-analysis"),
            )
        )

    if persona in ("student", "employed_exploring"):
        push(
            CareerPathCardOut(
                id="archetype-first-proof",
                title="First-proof packaging",
                subtitle="Projects, coursework, and volunteer signal",
                body=f"Stack evidence that substitutes for years in-role — especially useful while targeting {role}.",
                meta=base_meta,
                match=60 + readiness / 9,
                timeframe=_timeframe_for("archetype-first-proof", wizard_answers.get("weeklyCapacity")),
                required=["Project blurbs", "Impact bullets", "Skills block"],
                transferable=transfer_out,
                primary_cta=_cta("CV builder", "/app/cv-builder"),
                secondary_cta=_cta("LinkedIn analysis", "/app/linkedin-analysis"),
            )
        )

    if applications_total >= 3:
        pend_note = f" {pending_approval_count} draft(s) awaiting approval." if pending_approval_count else ""
        push(
            CareerPathCardOut(
                id="pipeline-momentum",
                title="Pipeline hygiene",
                subtitle="Tighten quality as volume grows",
                body=f"You have {applications_total} applications ({submitted} submitted). Use approvals and tracker to keep outreach on-brand for {role}.{pend_note}",
                meta=[*base_meta, f"{applications_total} applications"],
                match=64 + min(12, applications_total) + (3 if pending_approval_count else 0),
                timeframe=_timeframe_for("pipeline-momentum", wizard_answers.get("weeklyCapacity")),
                required=["Approval rhythm", "Recipient QA", "Status hygiene"],
                transferable=transfer_out,
                primary_cta=_cta("Job Tracker", "/app/tracker"),
                secondary_cta=_cta("Approvals", "/app/approvals"),
            )
        )

    paths.sort(key=lambda c: c.match, reverse=True)
    return paths[:6]


def _parse_wizard_state(goals: dict | None) -> PathfinderWizardStateOut:
    if not goals or not isinstance(goals, dict):
        return PathfinderWizardStateOut()
    raw = goals.get("pathfinder")
    if not isinstance(raw, dict):
        return PathfinderWizardStateOut()
    answers = raw.get("answers")
    ans: dict[str, str] = {}
    if isinstance(answers, dict):
        for k, v in answers.items():
            if isinstance(k, str) and isinstance(v, str) and v.strip():
                ans[k] = v.strip()
    completed = bool(raw.get("completed"))
    step = raw.get("current_step", 0)
    if isinstance(step, int):
        current_step = step
    elif isinstance(step, str) and step.isdigit():
        current_step = int(step)
    else:
        current_step = 0
    ca = raw.get("completed_at")
    completed_at = str(ca) if isinstance(ca, str) else None
    return PathfinderWizardStateOut(
        completed=completed,
        current_step=max(0, min(4, current_step)),
        answers=ans,
        completed_at=completed_at,
    )


def build_pathfinder_bundle(db: Session, user: User) -> PathfinderBundleOut:
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
    goals: dict | None = dict(profile.goals) if profile and isinstance(profile.goals, dict) else None

    latest = db.scalar(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == user.id)
        .order_by(desc(ResumeDocument.created_at))
        .limit(1)
    )
    resume_status = latest.status if latest else None
    parsed = latest.parsed_json if latest and isinstance(latest.parsed_json, dict) else None
    structured = _get_resume_structured(parsed)
    extracted = latest.extracted_text if latest else None

    total, by_status, pending_n = _workspace_counts(db, user.id)
    persona_ws = profile.persona if profile else None

    wizard_state = _parse_wizard_state(goals)
    paths = build_path_cards(
        profile=profile,
        goals=goals,
        resume_status=resume_status,
        structured=structured,
        extracted_text=extracted,
        persona_ws=persona_ws,
        applications_total=total,
        applications_by_status=by_status,
        pending_approval_count=pending_n,
        wizard_answers=wizard_state.answers,
    )
    return PathfinderBundleOut(wizard=wizard_state, paths=paths)


def merge_pathfinder_into_goals(
    goals: dict,
    *,
    answers_patch: dict[str, str | None] | None,
    current_step: int | None,
    completed: bool | None,
    reset: bool = False,
) -> dict:
    out = dict(goals)
    if reset:
        out["pathfinder"] = {"answers": {}, "current_step": 0, "completed": False}
        return out
    pf = dict(out.get("pathfinder") or {}) if isinstance(out.get("pathfinder"), dict) else {}
    if answers_patch:
        a = dict(pf.get("answers") or {})
        for k, v in answers_patch.items():
            if v is None:
                a.pop(k, None)
            elif isinstance(v, str) and v.strip():
                a[k] = v.strip()
        pf["answers"] = a
    if current_step is not None:
        pf["current_step"] = max(0, min(4, int(current_step)))
    if completed is True:
        pf["completed"] = True
        pf["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif completed is False:
        pf["completed"] = False
        pf.pop("completed_at", None)
    out["pathfinder"] = pf
    return out
