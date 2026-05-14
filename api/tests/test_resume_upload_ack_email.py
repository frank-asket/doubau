from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user import User
from app.tasks import _send_resume_upload_acknowledgement_email


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def test_resume_ack_skips_without_email_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    sent: list[dict] = []

    def capture(**kwargs: object) -> None:
        sent.append(dict(kwargs))

    monkeypatch.setattr("app.tasks._send_transactional_plain_email", capture)
    monkeypatch.setattr(settings_mod.settings, "resend_api_key", None)
    monkeypatch.setattr(settings_mod.settings, "resend_from", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_host", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_from", None)

    uid = uuid4()
    with SessionLocal() as db:
        db.add(User(id=uid, email=f"ack-skip-{uuid4()}@example.com", password_hash="x"))
        doc = ResumeDocument(
            user_id=uid,
            file_name="cv.pdf",
            content_type="application/pdf",
            size_bytes=1,
            s3_bucket="b",
            s3_key="k",
            status=ResumeStatus.EMBEDDED,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        _send_resume_upload_acknowledgement_email(db=db, doc=doc)
        try:
            db.execute(delete(ResumeDocument).where(ResumeDocument.user_id == uid))
            db.execute(delete(User).where(User.id == uid))
            db.commit()
        except Exception:
            pass

    assert sent == []


def test_resume_ack_sends_when_transport_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    sent: list[dict] = []

    def capture(**kwargs: object) -> None:
        sent.append(dict(kwargs))

    monkeypatch.setattr("app.tasks._send_transactional_plain_email", capture)
    monkeypatch.setattr(settings_mod.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings_mod.settings, "resend_from", "Doubow <onboarding@resend.dev>")
    monkeypatch.setattr(settings_mod.settings, "smtp_host", None)
    monkeypatch.setattr(settings_mod.settings, "smtp_from", None)

    uid = uuid4()
    email = f"ack-send-{uuid4()}@example.com"
    with SessionLocal() as db:
        db.add(User(id=uid, email=email, password_hash="x"))
        doc = ResumeDocument(
            user_id=uid,
            file_name="cv.pdf",
            content_type="application/pdf",
            size_bytes=1,
            s3_bucket="b",
            s3_key="k",
            status=ResumeStatus.EMBEDDED,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        _send_resume_upload_acknowledgement_email(db=db, doc=doc)
        try:
            db.execute(delete(ResumeDocument).where(ResumeDocument.user_id == uid))
            db.execute(delete(User).where(User.id == uid))
            db.commit()
        except Exception:
            pass

    assert len(sent) == 1
    assert sent[0]["to_addr"] == email
    assert "Acknowledgement of receipt" in str(sent[0]["subject"])
    assert "cv.pdf" in str(sent[0]["body"])
    assert "/app/dashboard" in str(sent[0]["body"])


def test_resume_ack_swallows_send_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import settings as settings_mod

    def boom(**_kwargs: object) -> None:
        raise RuntimeError("smtp_down")

    monkeypatch.setattr("app.tasks._send_transactional_plain_email", boom)
    monkeypatch.setattr(settings_mod.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings_mod.settings, "resend_from", "Doubow <onboarding@resend.dev>")

    uid = uuid4()
    with SessionLocal() as db:
        db.add(User(id=uid, email=f"ack-boom-{uuid4()}@example.com", password_hash="x"))
        doc = ResumeDocument(
            user_id=uid,
            file_name="cv.pdf",
            content_type="application/pdf",
            size_bytes=1,
            s3_bucket="b",
            s3_key="k",
            status=ResumeStatus.PARSED,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        _send_resume_upload_acknowledgement_email(db=db, doc=doc)
        try:
            db.execute(delete(ResumeDocument).where(ResumeDocument.user_id == uid))
            db.execute(delete(User).where(User.id == uid))
            db.commit()
        except Exception:
            pass
