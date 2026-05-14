from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.main import app
from app.models.application import Application, ApplicationStatus
from app.models.user import User
from app.security import decode_access_token
from app.tasks import send_followup_reminder_emails


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup() -> tuple[str, UUID]:
    from fastapi.testclient import TestClient

    client = TestClient(app)
    email = f"fu-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_followup_reminder_skips_without_mailer(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    monkeypatch.setattr(settings_mod.settings, "resend_api_key", None)
    monkeypatch.setattr(settings_mod.settings, "resend_from", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_host", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_from", None)
    out = send_followup_reminder_emails()
    assert out["status"] == "skipped"
    assert out["reason"] == "no_email_transport"


def test_followup_reminder_sends_and_marks_notified(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    sent: list[tuple[str, str, str]] = []

    def fake_smtp(*, to_addr: str, subject: str, body: str) -> None:
        sent.append((to_addr, subject, body))

    monkeypatch.setattr(settings_mod.settings, "resend_api_key", None)
    monkeypatch.setattr(settings_mod.settings, "resend_from", None)
    monkeypatch.setattr("app.tasks._smtp_send_text", fake_smtp)
    monkeypatch.setattr(settings_mod.settings, "smtp_host", "email-smtp.example.com")
    monkeypatch.setattr(settings_mod.settings, "smtp_from", "noreply@example.com")
    monkeypatch.setattr(settings_mod.settings, "smtp_user", "u")
    monkeypatch.setattr(settings_mod.settings, "smtp_password", "p")

    _, user_id = _signup()
    when = datetime.now(UTC) + timedelta(minutes=5)
    with SessionLocal() as db:
        u = db.get(User, user_id)
        assert u is not None
        app_row = Application(
            user_id=user_id,
            company="Umbrella",
            job_title="Scientist",
            source_url="https://example.com/job/1",
            status=ApplicationStatus.DISCOVERED,
            next_followup_at=when,
            followup_notified_for_at=None,
        )
        db.add(app_row)
        db.commit()
        app_id = app_row.id

    out = send_followup_reminder_emails()
    assert out["batches"] == 1
    assert len(sent) == 1
    assert "Umbrella" in sent[0][2]
    assert "/app/tracker" in sent[0][2]

    with SessionLocal() as db:
        row = db.get(Application, app_id)
        assert row is not None
        assert row.followup_notified_for_at == row.next_followup_at

    out2 = send_followup_reminder_emails()
    assert out2["batches"] == 0
    assert len(sent) == 1

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_followup_reminder_sends_via_resend(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    posts: list[dict[str, Any]] = []

    def fake_post(url: str, **kwargs: Any) -> httpx.Response:
        posts.append({"url": url, "json": kwargs.get("json"), "headers": kwargs.get("headers")})
        return httpx.Response(200, json={"id": "re_abc"})

    monkeypatch.setattr("app.tasks.httpx.post", fake_post)
    monkeypatch.setattr(settings_mod.settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings_mod.settings, "resend_from", "Doubow <onboarding@resend.dev>")
    monkeypatch.setattr(settings_mod.settings, "smtp_host", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_from", None)

    _, user_id = _signup()
    user_email = ""
    when = datetime.now(UTC) + timedelta(minutes=5)
    with SessionLocal() as db:
        u = db.get(User, user_id)
        assert u is not None
        user_email = u.email
        app_row = Application(
            user_id=user_id,
            company="Vandelay",
            job_title="Importer",
            source_url="https://example.com/job/v",
            status=ApplicationStatus.DISCOVERED,
            next_followup_at=when,
            followup_notified_for_at=None,
        )
        db.add(app_row)
        db.commit()
        app_id = app_row.id

    out = send_followup_reminder_emails()
    assert out["batches"] == 1
    assert len(posts) == 1
    assert posts[0]["url"] == "https://api.resend.com/emails"
    j = posts[0]["json"]
    assert j is not None
    assert j["from"] == "Doubow <onboarding@resend.dev>"
    assert j["to"] == [user_email]
    assert "Vandelay" in j["text"]

    with SessionLocal() as db:
        row = db.get(Application, app_id)
        assert row is not None
        assert row.followup_notified_for_at == row.next_followup_at

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass
