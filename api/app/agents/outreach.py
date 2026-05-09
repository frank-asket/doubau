"""
Phase 3 — Outreach drafter: email body generation with optional OpenAI.

Best-effort: falls back to a deterministic template when no API key or on failure.
"""

from __future__ import annotations

import json
import time
from typing import Any
from uuid import UUID

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.llm.logging import record_llm_interaction
from app.models.application import Application
from app.models.resume_document import ResumeDocument, ResumeStatus


def latest_resume_excerpt_for_user(db: Session, user_id: UUID, max_chars: int = 2500) -> str | None:
    row = db.execute(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == user_id)
        .where(ResumeDocument.status == ResumeStatus.EMBEDDED)
        .order_by(ResumeDocument.updated_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        row = db.execute(
            select(ResumeDocument)
            .where(ResumeDocument.user_id == user_id)
            .where(ResumeDocument.status == ResumeStatus.PARSED)
            .order_by(ResumeDocument.updated_at.desc())
            .limit(1)
        ).scalar_one_or_none()
    if row is None or not row.extracted_text:
        return None
    t = row.extracted_text.strip()
    if len(t) <= max_chars:
        return t
    return t[:max_chars] + "\n…"


def _fallback_email(app: Application) -> str:
    url = f"\n\nRole link: {app.source_url}" if app.source_url else ""
    return (
        f"Hi — I'm reaching out about the {app.job_title} role at {app.company}.{url}\n\n"
        "I'd love to share how my background aligns with what you're looking for. "
        "Would you be open to a brief conversation this week?\n\n"
        "Best regards"
    )


def generate_email_draft_content(
    db: Session,
    application: Application,
) -> tuple[str, dict[str, Any]]:
    """
    Returns (email_body, meta) where meta includes latency_ms or error.

    Writes one ``llm_logs`` row per call when logging is possible (has db session).
    """
    excerpt = latest_resume_excerpt_for_user(db, application.user_id)
    parts = (
        application.company,
        application.job_title,
        application.source_url or "",
        excerpt or "",
    )
    prompt_user = (
        f"Company: {application.company}\n"
        f"Role: {application.job_title}\n"
        f"Listing URL: {application.source_url or '(none)'}\n\n"
        "Résumé excerpt (may be empty):\n"
        f"{excerpt or '(none)'}\n\n"
        "Write a short, professional cold outreach email body (no subject line). "
        "4–7 sentences. No placeholders like [Your Name]; end politely."
    )

    meta: dict[str, Any] = {"agent": "outreach_email"}

    if not settings.openai_api_key:
        body = _fallback_email(application)
        record_llm_interaction(
            db,
            user_id=application.user_id,
            agent_name="outreach_email",
            prompt_parts=parts + ("fallback_template",),
            raw_output=body,
            latency_ms=None,
        )
        meta["mode"] = "fallback_no_openai"
        return body, meta

    t0 = time.perf_counter()
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You write concise, human outreach emails for job seekers. "
                        "Output only the email body plain text."
                    ),
                },
                {"role": "user", "content": prompt_user},
            ],
            temperature=0.65,
            max_tokens=600,
        )
        ms = int((time.perf_counter() - t0) * 1000)
        raw = (resp.choices[0].message.content or "").strip()
        if not raw:
            raise ValueError("empty completion")
        record_llm_interaction(
            db,
            user_id=application.user_id,
            agent_name="outreach_email",
            prompt_parts=parts + ("openai_chat",),
            raw_output=raw,
            latency_ms=ms,
        )
        meta["mode"] = "openai"
        meta["latency_ms"] = ms
        return raw, meta
    except Exception as e:  # noqa: BLE001
        ms = int((time.perf_counter() - t0) * 1000)
        body = _fallback_email(application)
        record_llm_interaction(
            db,
            user_id=application.user_id,
            agent_name="outreach_email",
            prompt_parts=parts + (f"error:{e!s}",),
            raw_output=f"[fallback after error] {body}",
            latency_ms=ms,
        )
        meta["mode"] = "fallback_error"
        meta["error"] = str(e)
        meta["latency_ms"] = ms
        return body, meta


def generate_interview_prep_content(
    db: Session,
    *,
    user_id: UUID,
    company: str,
    job_title: str,
    description_excerpt: str | None,
    resume_excerpt: str | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Returns (parsed_json_dict, meta). Dict has themes, suggested_questions, talking_points (lists).
    """
    parts = (company, job_title, description_excerpt or "", resume_excerpt or "")
    empty_out: dict[str, Any] = {
        "themes": ["Role fit", "Impact", "Culture"],
        "suggested_questions": [
            f"What does success look like in the first 90 days for {job_title}?",
            "How does the team collaborate day to day?",
        ],
        "talking_points": [
            "Connect your recent wins to the responsibilities mentioned in the posting.",
        ],
    }

    if not settings.openai_api_key:
        record_llm_interaction(
            db,
            user_id=user_id,
            agent_name="interview_prep",
            prompt_parts=parts + ("fallback_static",),
            raw_output=json.dumps(empty_out),
            latency_ms=None,
        )
        return empty_out, {"mode": "fallback_no_openai"}

    schema_hint = (
        '{"themes": string[], "suggested_questions": string[], "talking_points": string[]}'
    )
    prompt = (
        f"Company: {company}\nRole: {job_title}\n\n"
        f"Job description excerpt:\n{description_excerpt or '(none)'}\n\n"
        f"Candidate résumé excerpt:\n{resume_excerpt or '(none)'}\n\n"
        "Respond with a single JSON object only, matching: "
        f"{schema_hint}. Keep arrays short (max 5 items each)."
    )

    t0 = time.perf_counter()
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You prepare concise interview prep from job + résumé context.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=800,
        )
        ms = int((time.perf_counter() - t0) * 1000)
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("expected JSON object")
        for key in ("themes", "suggested_questions", "talking_points"):
            if key not in data:
                data[key] = empty_out[key]
            elif not isinstance(data[key], list):
                data[key] = empty_out[key]
        record_llm_interaction(
            db,
            user_id=user_id,
            agent_name="interview_prep",
            prompt_parts=parts + ("openai_json",),
            raw_output=json.dumps(data),
            latency_ms=ms,
        )
        return data, {"mode": "openai", "latency_ms": ms}
    except Exception as e:  # noqa: BLE001
        ms = int((time.perf_counter() - t0) * 1000)
        record_llm_interaction(
            db,
            user_id=user_id,
            agent_name="interview_prep",
            prompt_parts=parts + (f"error:{e!s}",),
            raw_output=json.dumps(empty_out),
            latency_ms=ms,
        )
        return empty_out, {"mode": "fallback_error", "error": str(e), "latency_ms": ms}
