"""Structured per-role insight report (career-ops–style blocks, single JSON)."""

from __future__ import annotations

import json
from typing import Any

from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.agents.interview_rag import load_job_description_for_application
from app.agents.outreach import latest_resume_full_text
from app.core.settings import settings
from app.models.application import Application


class RoleReportPayload(BaseModel):
    """Persisted JSON shape for ``Application.role_report``."""

    role_summary: str = Field(..., min_length=1, max_length=4000)
    cv_match_summary: str = Field(..., min_length=1, max_length=4000)
    gaps: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    interview_talking_points: list[str] = Field(default_factory=list)
    fit_score: float = Field(..., ge=0, le=100)
    fit_match_pct: float = Field(..., ge=0, le=100)
    fit_rationale: str = Field(..., min_length=1, max_length=4000)


class RoleReportError(Exception):
    """LLM or validation failure."""


def build_role_report_for_application(db: Session, app: Application) -> dict[str, Any]:
    """
    Compare latest résumé text to the job description and return a validated dict
    suitable for ``Application.role_report``.
    """
    if not settings.openai_api_key:
        raise RoleReportError("DOUBOW_OPENAI_API_KEY is not set")

    jd = load_job_description_for_application(db, app.source_url, app.job_id)
    if not (jd or "").strip():
        raise RoleReportError(
            "No job description on file for this application. Link a catalog job or listing URL with text.",
        )

    resume = latest_resume_full_text(db, app.user_id)
    if not (resume or "").strip():
        raise RoleReportError("Upload and parse a résumé before generating a role report.")

    jd_block = (jd or "").strip()[:12000]
    resume_block = resume.strip()[: settings.embedding_max_input_chars]

    sys_msg = (
        "You are an expert career coach. Compare the candidate résumé to the job posting. "
        "Respond ONLY with one JSON object (no markdown) with keys exactly: "
        "role_summary (string), cv_match_summary (string), gaps (string[]), strengths (string[]), "
        "interview_talking_points (string[], 3–7 bullets), "
        "fit_score (number 0-100), fit_match_pct (number 0-100), fit_rationale (string). "
        "Do not invent employers or credentials. Keep gaps and strengths factual vs the JD."
    )
    user_msg = (
        f"COMPANY: {app.company}\nTITLE: {app.job_title}\n\nJOB DESCRIPTION:\n{jd_block}\n\n"
        f"RÉSUMÉ:\n{resume_block}"
    )

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.25,
        )
    except Exception as e:
        raise RoleReportError(str(e)) from e

    raw = resp.choices[0].message.content
    if not raw:
        raise RoleReportError("Empty model response")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RoleReportError(f"Invalid JSON: {e}") from e

    try:
        validated = RoleReportPayload.model_validate(data)
    except ValidationError as e:
        raise RoleReportError(str(e)) from e

    return validated.model_dump()


def build_followup_draft_body(db: Session, app: Application) -> str:
    """Plain-text follow-up email body; human sends from their own mailbox."""
    if not settings.openai_api_key:
        raise RoleReportError("DOUBOW_OPENAI_API_KEY is not set")

    jd = (load_job_description_for_application(db, app.source_url, app.job_id) or "").strip()[:6000]
    resume = (latest_resume_full_text(db, app.user_id) or "").strip()[:8000]

    sys_msg = (
        "Write a short polite follow-up email body (no subject line) the candidate can paste "
        "into their own email client 5–10 days after applying. 3–6 sentences. "
        "Reference the role and company. No placeholders like [Your name]. "
        "Do not claim the employer read or responded. Plain text only."
    )
    user_msg = f"Company: {app.company}\nRole: {app.job_title}\n\nJD excerpt:\n{jd}\n\nRésumé excerpt:\n{resume[:4000]}"

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.35,
            max_tokens=500,
        )
    except Exception as e:
        raise RoleReportError(str(e)) from e

    body = (resp.choices[0].message.content or "").strip()
    if not body:
        raise RoleReportError("Empty follow-up draft")
    return body
