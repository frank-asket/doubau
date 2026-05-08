"""
Fit scorer (Phase 2): structured JSON validated before returning to clients.
"""

from __future__ import annotations

import json

from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.settings import settings
from app.models.job import Job


class FitScoreOut(BaseModel):
    score: float = Field(..., ge=0, le=100, description="Overall fit 0–100")
    match_pct: float = Field(..., ge=0, le=100, description="Percent role alignment")
    rationale: str = Field(..., min_length=1, max_length=4000)
    gap_skills: list[str] = Field(default_factory=list)
    strength_skills: list[str] = Field(default_factory=list)


class FitScoreError(Exception):
    """LLM returned invalid or non-schema JSON."""


def compute_fit_score(*, job: Job, resume_text: str) -> FitScoreOut:
    if not settings.openai_api_key:
        raise FitScoreError("DOUBOW_OPENAI_API_KEY is not set")

    jd = "\n".join(
        filter(
            None,
            [
                f"Title: {job.title}",
                f"Company: {job.company}",
                job.description or "",
            ],
        )
    )
    sys_msg = (
        "You are an expert recruiter. Compare the résumé to the job and respond ONLY "
        "with a single JSON object matching this schema: "
        '{"score": number 0-100, "match_pct": number 0-100, "rationale": string, '
        '"gap_skills": string[], "strength_skills": string[]}. '
        "No markdown, no prose outside JSON."
    )
    user_msg = f"JOB:\n{jd}\n\nRÉSUMÉ TEXT:\n{resume_text[: settings.embedding_max_input_chars]}"

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
        )
    except Exception as e:
        raise FitScoreError(str(e)) from e

    raw = resp.choices[0].message.content
    if not raw:
        raise FitScoreError("Empty model response")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise FitScoreError(f"Invalid JSON: {e}") from e

    try:
        return FitScoreOut.model_validate(data)
    except ValidationError as e:
        raise FitScoreError(str(e)) from e
