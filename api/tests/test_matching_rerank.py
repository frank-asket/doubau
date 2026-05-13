from datetime import UTC, datetime, timedelta

from app.jobs.matching import (
    feed_blend_weights,
    location_match_score,
    normalize_location_token,
    recency_score,
    seniority_match_score,
    weighted_match_score,
)


def test_normalize_location_token_west_africa() -> None:
    assert normalize_location_token("Accra, Ghana") == "gh"
    assert normalize_location_token("Lagos NG") == "ng"
    assert normalize_location_token("Remote (Worldwide)") == "remote"


def test_normalize_location_token_global_cities() -> None:
    assert normalize_location_token("London, UK") == "uk"
    assert normalize_location_token("New York, NY") == "us"
    assert normalize_location_token("Berlin, Germany") == "de"
    assert normalize_location_token("Singapore") == "sg"


def test_location_match_score_remote_soft_match() -> None:
    assert location_match_score(user_location="Lagos", job_location="Remote") > 0.0
    assert location_match_score(user_location="Accra", job_location="Accra, Ghana") == 1.0


def test_location_match_score_worldwide_softens_cross_region() -> None:
    s_default = location_match_score(user_location="Paris, France", job_location="Tokyo, Japan")
    s_world = location_match_score(
        user_location="Paris, France",
        job_location="Tokyo, Japan",
        match_scope="worldwide",
    )
    assert s_default == 0.0
    assert s_world > 0.0
    assert location_match_score(user_location=None, job_location="Madrid", match_scope="worldwide") == 0.58


def test_feed_blend_weights_worldwide_favors_vector() -> None:
    d = feed_blend_weights(match_scope="default")
    w = feed_blend_weights(match_scope="worldwide")
    assert w[0] > d[0]  # w_vec
    assert w[1] < d[1]  # w_loc


def test_seniority_match_score_basic() -> None:
    jr = seniority_match_score(
        years_experience="1 year",
        job_seniority=None,
        job_title="Junior Analyst",
    )
    sr = seniority_match_score(
        years_experience="1 year",
        job_seniority=None,
        job_title="Senior Analyst",
    )
    assert jr > sr


def test_weighted_match_prefers_recent_when_tied() -> None:
    now = datetime.now(UTC)
    r_new = recency_score(posted_at=now - timedelta(days=1), created_at=now, window_days=30)
    r_old = recency_score(posted_at=now - timedelta(days=20), created_at=now, window_days=30)
    a = weighted_match_score(
        vector_sim=0.8,
        location_score=0.5,
        seniority_score=0.5,
        recency_score_=r_new,
    )
    b = weighted_match_score(
        vector_sim=0.8,
        location_score=0.5,
        seniority_score=0.5,
        recency_score_=r_old,
    )
    assert a > b

