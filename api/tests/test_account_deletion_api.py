from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.main import app
from app.models.application import Application
from app.models.check_in import CheckIn
from app.models.milestone import Milestone
from app.models.outreach_draft import OutreachDraft
from app.models.profile import Profile
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user import User
from app.security import decode_access_token


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient, prefix: str) -> tuple[str, UUID]:
    email = f"{prefix}-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_delete_account_erases_user_data_and_resume_objects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    token_a, user_a = _signup(client, "delete-a")
    token_b, user_b = _signup(client, "delete-b")

    deleted_objects: list[tuple[str, str]] = []

    class FakeS3:
        def delete_object(self, *, Bucket: str, Key: str) -> dict:
            deleted_objects.append((Bucket, Key))
            return {}

    monkeypatch.setattr("app.api.me.s3_client", lambda: FakeS3())

    app_id = uuid4()
    resume_a_id = uuid4()
    resume_b_id = uuid4()
    with SessionLocal() as db:
        db.add(
            ResumeDocument(
                id=resume_a_id,
                user_id=user_a,
                status=ResumeStatus.PARSED,
                file_name="a.pdf",
                content_type="application/pdf",
                size_bytes=10,
                s3_bucket="test-bucket",
                s3_key=f"resumes/{user_a}/a.pdf",
                extracted_text="user a resume",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        db.add(
            ResumeDocument(
                id=resume_b_id,
                user_id=user_b,
                status=ResumeStatus.PARSED,
                file_name="b.pdf",
                content_type="application/pdf",
                size_bytes=11,
                s3_bucket="test-bucket",
                s3_key=f"resumes/{user_b}/b.pdf",
                extracted_text="user b resume",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        )
        app_row = Application(
            id=app_id,
            user_id=user_a,
            company="DeleteCo",
            job_title="Engineer",
        )
        db.add(app_row)
        db.flush()
        db.add(OutreachDraft(application_id=app_id, channel="email", content="hello"))
        db.add(Milestone(user_id=user_a, title="Delete milestone", meta={}))
        db.add(CheckIn(user_id=user_a, mood=4))
        db.commit()

    resp = client.delete("/me/account", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "deleted"
    assert body["deleted_user_id"] == str(user_a)
    assert body["deleted_resume_objects"] == 1
    assert body["deleted_resume_documents"] == 1
    assert deleted_objects == [("test-bucket", f"resumes/{user_a}/a.pdf")]

    with SessionLocal() as db:
        assert db.get(User, user_a) is None
        assert db.scalar(select(Profile).where(Profile.user_id == user_a)) is None
        assert db.scalar(select(ResumeDocument).where(ResumeDocument.user_id == user_a)) is None
        assert db.scalar(select(Application).where(Application.user_id == user_a)) is None
        assert db.scalar(select(Milestone).where(Milestone.user_id == user_a)) is None
        assert db.scalar(select(CheckIn).where(CheckIn.user_id == user_a)) is None

        assert db.get(User, user_b) is not None
        assert db.get(ResumeDocument, resume_b_id) is not None

    old_token_resp = client.get("/me/profile", headers={"Authorization": f"Bearer {token_a}"})
    assert old_token_resp.status_code == 401

    user_b_resp = client.get("/me/profile", headers={"Authorization": f"Bearer {token_b}"})
    assert user_b_resp.status_code == 200

    with SessionLocal() as db:
        db.execute(delete(User).where(User.id == user_b))
        db.commit()


def test_delete_account_requires_auth() -> None:
    client = TestClient(app)
    resp = client.delete("/me/account")
    assert resp.status_code == 401
