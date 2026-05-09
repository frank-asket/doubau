from __future__ import annotations

import re
from datetime import UTC, datetime


def normalize_location_token(s: str | None) -> str | None:
    """
    Normalize location strings to a coarse token we can match on.

    Goal: cheap + predictable, not perfect geo-coding.
    """
    if not s:
        return None
    v = re.sub(r"\s+", " ", s).strip().lower()
    if not v:
        return None

    if "remote" in v:
        return "remote"

    # Country hints (West Africa focus)
    if "ghana" in v or re.search(r"\bgh\b", v):
        return "gh"
    if "nigeria" in v or re.search(r"\bng\b", v):
        return "ng"
    if "senegal" in v or re.search(r"\bsn\b", v):
        return "sn"

    # Major cities (map to country token)
    if any(x in v for x in ("lagos", "abuja", "port harcourt")):
        return "ng"
    if any(x in v for x in ("accra", "kumasi", "tema")):
        return "gh"
    if any(x in v for x in ("dakar",)):
        return "sn"

    return v[:32]


def location_match_score(*, user_location: str | None, job_location: str | None) -> float:
    """
    Soft match: remote always "good"; exact coarse token match is best.
    """
    u = normalize_location_token(user_location)
    j = normalize_location_token(job_location)
    if not u and not j:
        return 0.5
    if j == "remote":
        return 0.8
    if u and j and u == j:
        return 1.0
    if u and j and ("remote" in (u, j)):
        return 0.8
    return 0.0


def _parse_years_experience(s: str | None) -> float | None:
    if not s:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def seniority_match_score(
    *,
    years_experience: str | None,
    job_seniority: str | None,
    job_title: str | None,
) -> float:
    """
    Best-effort: many jobs won't have structured seniority yet.
    """
    yrs = _parse_years_experience(years_experience)
    if yrs is None:
        return 0.5

    seniority_text = (job_seniority or "") + " " + (job_title or "")
    seniority_text = seniority_text.lower()

    if yrs <= 1.5:
        target = "junior"
    elif yrs <= 4.5:
        target = "mid"
    else:
        target = "senior"

    if target == "junior":
        if any(k in seniority_text for k in ("intern", "graduate", "junior", "entry")):
            return 1.0
        if any(k in seniority_text for k in ("senior", "lead", "staff", "principal")):
            return 0.0
        return 0.6

    if target == "mid":
        if any(k in seniority_text for k in ("senior", "lead", "staff", "principal")):
            return 0.5
        if any(k in seniority_text for k in ("junior", "entry", "intern", "graduate")):
            return 0.5
        return 0.7

    # target == senior
    if any(k in seniority_text for k in ("senior", "lead", "staff", "principal")):
        return 1.0
    if any(k in seniority_text for k in ("junior", "entry", "intern", "graduate")):
        return 0.0
    return 0.6


def recency_score(*, posted_at: datetime | None, created_at: datetime, window_days: int) -> float:
    """
    Map age (0..window_days) -> (1..0). Older than window -> 0.
    """
    base = posted_at or created_at
    if base.tzinfo is None:
        # stored as tz-aware in DB, but keep safe
        base = base.replace(tzinfo=UTC)
    now = datetime.now(UTC)
    age_days = (now - base).total_seconds() / 86400.0
    w = max(1.0, float(window_days))
    if age_days <= 0:
        return 1.0
    if age_days >= w:
        return 0.0
    return max(0.0, 1.0 - (age_days / w))


def weighted_match_score(
    *,
    vector_sim: float,
    location_score: float,
    seniority_score: float,
    recency_score_: float,
    w_vec: float = 0.5,
    w_loc: float = 0.2,
    w_sen: float = 0.2,
    w_rec: float = 0.1,
) -> float:
    """
    Weighted blend in [0..1]. Keep weights stable for v1.
    """
    vec = max(0.0, min(1.0, vector_sim))
    loc = max(0.0, min(1.0, location_score))
    sen = max(0.0, min(1.0, seniority_score))
    rec = max(0.0, min(1.0, recency_score_))
    return (w_vec * vec) + (w_loc * loc) + (w_sen * sen) + (w_rec * rec)

