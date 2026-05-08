from app.api.jobs import _score_job_heuristic as _score_job
from app.models.job import Job


def test_student_jobs_rank_internships_higher() -> None:
    intern = Job(company="A", title="Software Intern", tags=["intern"])
    senior = Job(company="B", title="Senior Software Engineer", tags=["senior"])

    assert _score_job(job=intern, persona="student", focus=["find_jobs"]) > _score_job(
        job=senior, persona="student", focus=["find_jobs"]
    )

