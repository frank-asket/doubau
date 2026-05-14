from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

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


def test_followup_reminder_skips_without_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    monkeypatch.setattr(settings_mod.settings, "smtp_host", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_from", None)
    out = send_followup_reminder_emails()
    assert out["status"] == "skipped"


def test_followup_reminder_sends_and_marks_notified(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    sent: list[tuple[str, str, str]] = []

    def fake_smtp(*, to_addr: str, subject: str, body: str) -> None:
        sent.append((to_addr, subject, body))

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
