from app.api.jobs import _score_job_heuristic as _score_job
from app.api.jobs import _score_reason
from app.models.job import Job


def test_student_jobs_rank_internships_higher() -> None:
    intern = Job(company="A", title="Software Intern", tags=["intern"])
    senior = Job(company="B", title="Senior Software Engineer", tags=["senior"])

    assert _score_job(job=intern, persona="student", focus=["find_jobs"]) > _score_job(
        job=senior, persona="student", focus=["find_jobs"]
    )


def test_score_reason_explains_match_components() -> None:
    reason = _score_reason(
        similarity=0.72,
        location_score_=1.0,
        seniority_score_=0.9,
        recency_score__=0.2,
        feedback_adjustment=0.0,
    )

    assert "résumé" in reason
    assert "location" in reason
