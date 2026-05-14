from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Literal

MatchScope = Literal["default", "worldwide"]

# Coarse region tokens for cheap matching (substring on lowercased free text).
# Order: more specific phrases before broad country names where needed.
_TOKEN_KEYWORDS: dict[str, tuple[str, ...]] = {
    "gh": ("ghana", "accra", "kumasi", "tema"),
    "ng": ("nigeria", "lagos", "abuja", "port harcourt"),
    "sn": ("senegal", "dakar"),
    "ke": ("kenya", "nairobi"),
    "za": ("south africa", "johannesburg", "cape town", "durban"),
    "eg": ("egypt", "cairo"),
    "ma": ("morocco", "casablanca"),
    "us": (
        "united states",
        "u.s.",
        "usa",
        ", us",
        " us ",
        "new york",
        "san francisco",
        "los angeles",
        "chicago",
        "seattle",
        "austin",
        "boston",
        "denver",
        "atlanta",
        "miami",
        "houston",
        "dallas",
        "phoenix",
        "philadelphia",
        "detroit",
        "minneapolis",
        "portland",
        "california",
        "texas",
        "florida",
        "washington dc",
        "washington, dc",
    ),
    "ca": ("canada", "toronto", "vancouver", "montreal", "calgary", "ottawa"),
    "uk": (
        "united kingdom",
        " england",
        " scotland",
        " wales",
        "london",
        "manchester",
        "birmingham",
        "glasgow",
        "edinburgh",
        "bristol",
        "leeds",
        "liverpool",
    ),
    "ie": ("ireland", "dublin", "cork", "galway"),
    "de": ("germany", "deutschland", "berlin", "munich", "hamburg", "frankfurt", "cologne", "stuttgart"),
    "fr": ("france", "paris", "lyon", "marseille", "toulouse", "bordeaux"),
    "nl": ("netherlands", "holland", "amsterdam", "rotterdam", "utrecht", "eindhoven"),
    "es": ("spain", "madrid", "barcelona", "valencia", "seville"),
    "pt": ("portugal", "lisbon", "porto"),
    "it": ("italy", "rome", "milan", "turin", "florence", "naples"),
    "ch": ("switzerland", "zurich", "geneva", "basel", "bern"),
    "at": ("austria", "vienna"),
    "be": ("belgium", "brussels", "antwerp"),
    "se": ("sweden", "stockholm", "gothenburg", "malmö", "malmo"),
    "no": ("norway", "oslo", "bergen"),
    "dk": ("denmark", "copenhagen", "aarhus"),
    "fi": ("finland", "helsinki"),
    "pl": ("poland", "warsaw", "krakow", "wrocław", "gdansk"),
    "cz": ("czechia", "czech republic", "prague", "brno"),
    "ro": ("romania", "bucharest", "cluj"),
    "gr": ("greece", "athens", "thessaloniki"),
    "ae": ("uae", "united arab emirates", "dubai", "abu dhabi"),
    "sa": ("saudi arabia", "riyadh", "jeddah"),
    "il": ("israel", "tel aviv", "jerusalem", "haifa"),
    "in": ("india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai", "kolkata"),
    "sg": ("singapore",),
    "hk": ("hong kong",),
    "jp": ("japan", "tokyo", "osaka", "kyoto", "yokohama"),
    "kr": ("south korea", "korea", "seoul", "busan"),
    "cn": ("china", "beijing", "shanghai", "shenzhen", "guangzhou"),
    "tw": ("taiwan", "taipei"),
    "au": ("australia", "sydney", "melbourne", "brisbane", "perth", "adelaide"),
    "nz": ("new zealand", "auckland", "wellington"),
    "mx": ("mexico", "mexico city", "guadalajara", "monterrey"),
    "br": ("brazil", "são paulo", "sao paulo", "rio de janeiro", "brasília", "brasilia"),
    "ar": ("argentina", "buenos aires"),
    "cl": ("chile", "santiago"),
    "co": ("colombia", "bogotá", "bogota", "medellín", "medellin"),
}


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

    if any(
        x in v
        for x in (
            "remote",
            "anywhere",
            "worldwide",
            "distributed",
            "fully remote",
            "work from home",
            "wfh",
        )
    ):
        return "remote"

    for token, keywords in _TOKEN_KEYWORDS.items():
        if any(k in v for k in keywords):
            return token

    # ISO-like 2-letter country hints at end ", xx"
    m = re.search(r",\s*([a-z]{2})\s*$", v)
    if m:
        return m.group(1)

    return v[:32]


def location_match_score(
    *,
    user_location: str | None,
    job_location: str | None,
    match_scope: MatchScope = "default",
) -> float:
    """
    Soft match: remote always strong; same coarse token is best.
    ``match_scope=worldwide`` de-emphasizes mismatched countries so résumé similarity can dominate.
    """
    u = normalize_location_token(user_location)
    j = normalize_location_token(job_location)

    if match_scope == "worldwide":
        if j == "remote":
            return 0.92
        if not u:
            return 0.58
        if u and j and u == j:
            return 1.0
        if u and j and u != j:
            return 0.42
        return 0.52

    # default scope — stricter regional behaviour (legacy)
    if not u and not j:
        return 0.5
    if j == "remote":
        return 0.8
    if u and j and u == j:
        return 1.0
    if u and j and ("remote" in (u, j)):
        return 0.8
    return 0.0


def feed_blend_weights(*, match_scope: MatchScope) -> tuple[float, float, float, float]:
    """(w_vec, w_loc, w_sen, w_rec) for ``weighted_match_score`` — worldwide favors semantic fit."""
    if match_scope == "worldwide":
        return (0.58, 0.12, 0.2, 0.1)
    return (0.5, 0.2, 0.2, 0.1)


# Default catalog priority: RapidAPI JSearch first, then other aggregators, then niche providers.
# Must match ``catalog_sql_tier`` source order in ``app.api.jobs`` feed (non-embedding path).
_CATALOG_LISTING_SOURCE_PRIORITY: tuple[str, ...] = (
    "jsearch",
    "active_jobs_db",
    "serpapi_google_jobs",
    "adzuna",
    "greenhouse",
    "lever",
    "ashby",
    "workday_cxs",
    "scrapling_jsonld",
    "scrapling",
    "remoteok",
    "http_fetch",
    "manual",
)


def catalog_listing_source_priority_rank(listing_source: str | None) -> int:
    """Tie-break rank for feed ordering — lower means preferred when scores match."""
    s = (listing_source or "").strip().lower()[:80]
    try:
        return _CATALOG_LISTING_SOURCE_PRIORITY.index(s)
    except ValueError:
        return len(_CATALOG_LISTING_SOURCE_PRIORITY)


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
    Weighted blend in [0..1]. Keep weights stable for v1 unless overridden by ``feed_blend_weights``.
    """
    vec = max(0.0, min(1.0, vector_sim))
    loc = max(0.0, min(1.0, location_score))
    sen = max(0.0, min(1.0, seniority_score))
    rec = max(0.0, min(1.0, recency_score_))
    return (w_vec * vec) + (w_loc * loc) + (w_sen * sen) + (w_rec * rec)
