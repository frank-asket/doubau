from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.core.settings import settings
from app.db import SessionLocal, engine
from app.main import app
from app.models.user import User
from app.security import decode_access_token
from app.tasks import send_signup_welcome_email_sync


def test_send_signup_welcome_email_sync_invokes_mailer(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, str]] = []

    def capture(*, to_addr: str, subject: str, body: str) -> None:
        calls.append({"to_addr": to_addr, "subject": subject, "body": body})

    monkeypatch.setattr("app.tasks._send_transactional_plain_email", capture)
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "resend_from", "Doubow <onboarding@resend.dev>")
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)

    send_signup_welcome_email_sync("  hello@example.com  ")
    assert len(calls) == 1
    assert calls[0]["to_addr"] == "hello@example.com"
    assert calls[0]["subject"] == "Welcome to Doubow"
    assert "/app/dashboard" in calls[0]["body"]


def test_send_signup_welcome_email_sync_skips_without_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def capture(*, to_addr: str, subject: str, body: str) -> None:
        calls.append(to_addr)

    monkeypatch.setattr("app.tasks._send_transactional_plain_email", capture)
    monkeypatch.setattr(settings, "resend_api_key", None)
    monkeypatch.setattr(settings, "resend_from", None)
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)

    send_signup_welcome_email_sync("anyone@example.com")
    assert calls == []


def _require_postgres_or_skip() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def test_signup_sends_welcome_via_background_task(monkeypatch: pytest.MonkeyPatch) -> None:
    _require_postgres_or_skip()
    sent: list[tuple[str, str, str]] = []

    def capture(*, to_addr: str, subject: str, body: str) -> None:
        sent.append((to_addr, subject, body))

    monkeypatch.setattr("app.tasks._send_transactional_plain_email", capture)
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "resend_from", "Doubow <onboarding@resend.dev>")
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)

    email = f"welcome-{uuid4()}@example.com"
    client = TestClient(app)
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text

    assert len(sent) == 1
    assert sent[0][0] == email
    assert sent[0][1] == "Welcome to Doubow"
    assert "/app/dashboard" in sent[0][2]

    payload = decode_access_token(r.json()["access_token"])
    user_id = payload["sub"]

    try:
        with SessionLocal() as db:
            db.execute(delete(User).where(User.id == UUID(str(user_id))))
            db.commit()
    except Exception:
        pass
