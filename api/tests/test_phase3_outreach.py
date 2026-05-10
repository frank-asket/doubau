from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, text
from sqlalchemy.exc import OperationalError

from app.core.settings import settings
from app.db import SessionLocal, engine
from app.llm.logging import prompt_sha256
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.llm_log import LlmLog
from app.models.outreach_draft import DraftStatus, OutreachDraft
from app.models.user import User
from app.security import decode_access_token
from app.tasks import dispatch_application_outbound


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def test_prompt_sha256_stable() -> None:
    a = prompt_sha256("x", "y")
    b = prompt_sha256("x", "y")
    assert a == b
    assert len(a) == 64


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"phase3-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_generate_draft_creates_llm_log_fallback() -> None:
    """Without OpenAI, drafter uses template and writes llm_logs."""
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Acme", "job_title": "PM", "source_url": "https://example.com/j"},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    before = 0
    with SessionLocal() as db:
        before = db.execute(select(LlmLog).where(LlmLog.user_id == user_id)).scalars().all()
        before_n = len(before)

    r1 = client.post(f"/applications/{app_id}/generate_draft", headers=headers)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert "Acme" in body["email"]["content"] or "Acme" in body["linkedin"]["content"]
    assert body["email"]["status"] == "DRAFT"
    assert body["linkedin"]["status"] == "DRAFT"

    with SessionLocal() as db:
        after = db.execute(select(LlmLog).where(LlmLog.user_id == user_id)).scalars().all()
        assert len(after) == before_n + 2
        assert any(x.agent_name == "outreach_email" for x in after)
        assert any(x.agent_name == "outreach_linkedin" for x in after)

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == UUID(app_id)))
            db.execute(delete(LlmLog).where(LlmLog.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_dispatch_outbound_smtp_marks_email_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    """With SMTP configured, dispatch sends via mocked SMTP and marks the email draft SENT."""
    calls: list[dict[str, str]] = []

    def fake_smtp(*, to_addr: str, subject: str, body: str) -> None:
        calls.append({"to_addr": to_addr, "subject": subject, "body": body})

    monkeypatch.setattr("app.tasks._smtp_send_text", fake_smtp)
    monkeypatch.setattr(settings, "smtp_host", "email-smtp.eu-west-3.amazonaws.com")
    monkeypatch.setattr(settings, "smtp_from", "noreply@verified.example")
    monkeypatch.setattr(settings, "smtp_user", "AKIAIOSFODNN7EXAMPLE")
    monkeypatch.setattr(settings, "smtp_password", "dummy-smtp-secret")

    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Acme", "job_title": "PM", "source_url": "https://example.com/j"},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    client.post(f"/applications/{app_id}/generate_draft", headers=headers)
    client.post(f"/applications/{app_id}/approve", headers=headers)

    with SessionLocal() as db:
        row = db.get(Application, UUID(app_id))
        assert row is not None
        row.status = ApplicationStatus.SUBMITTED
        db.commit()

    out = dispatch_application_outbound.run(str(app_id))
    assert out["status"] == "ok"
    assert any(r.get("channel") == "email" and r.get("sent") is True for r in out["results"])
    assert len(calls) == 1

    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        assert calls[0]["to_addr"] == user.email
        drafts = db.scalars(select(OutreachDraft).where(OutreachDraft.application_id == UUID(app_id))).all()
        by_ch = {d.channel: d for d in drafts}
        assert by_ch["email"].status == DraftStatus.SENT
        assert by_ch["linkedin"].status == DraftStatus.DRAFT

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == UUID(app_id)))
            db.execute(delete(LlmLog).where(LlmLog.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_interview_prep_returns_json_shape() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Globex", "job_title": "Engineer", "source_url": None},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    r1 = client.post(f"/applications/{app_id}/interview_prep", headers=headers)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert "themes" in body and isinstance(body["themes"], list)
    assert "suggested_questions" in body
    assert "talking_points" in body

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == UUID(app_id)))
            db.execute(delete(LlmLog).where(LlmLog.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass
