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
from app.models.job import Job
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


def test_create_application_reuses_same_job_id() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    job_id = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=job_id,
                company="BetaCo",
                title="Eng",
                location="Remote",
                tags=[],
                source_url="https://example.com/listing-beta",
            )
        )
        db.commit()

    payload = {
        "company": "BetaCo",
        "job_title": "Eng",
        "source_url": "https://example.com/listing-beta",
        "job_id": str(job_id),
    }
    r1 = client.post("/applications", headers=headers, json=payload)
    r2 = client.post("/applications", headers=headers, json=payload)
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert r1.json()["id"] == r2.json()["id"]
    assert r1.json().get("job_id") == str(job_id)

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(Job).where(Job.id == job_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_create_application_unknown_job_id() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    bogus = uuid4()
    r = client.post(
        "/applications",
        headers=headers,
        json={"company": "X", "job_title": "Y", "job_id": str(bogus)},
    )
    assert r.status_code == 422, r.text
    try:
        with SessionLocal() as db:
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_create_application_reuses_same_source_url() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "company": "Acme",
        "job_title": "PM",
        "source_url": "https://example.com/same-role",
    }

    r1 = client.post("/applications", headers=headers, json=payload)
    r2 = client.post("/applications", headers=headers, json=payload)

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert r1.json()["id"] == r2.json()["id"]

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_generate_draft_is_idempotent_for_pending_application() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Acme", "job_title": "PM", "source_url": "https://example.com/pending"},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    r1 = client.post(f"/applications/{app_id}/generate_draft", headers=headers)
    r2 = client.post(f"/applications/{app_id}/generate_draft", headers=headers)

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    with SessionLocal() as db:
        drafts = db.scalars(
            select(OutreachDraft).where(OutreachDraft.application_id == UUID(app_id))
        ).all()
        assert len(drafts) == 2

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == UUID(app_id)))
            db.execute(delete(LlmLog).where(LlmLog.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_approve_requires_generated_draft() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    with SessionLocal() as db:
        row = Application(
            user_id=user_id,
            company="NoDraftCo",
            job_title="Product Manager",
            status=ApplicationStatus.PENDING_APPROVAL,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        app_id = row.id

    r = client.post(f"/applications/{app_id}/approve", headers=headers)
    assert r.status_code == 409, r.text
    assert "draft" in r.json()["detail"].lower()

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == app_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_submit_requires_approved_application_with_draft() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    with SessionLocal() as db:
        row = Application(
            user_id=user_id,
            company="NoDraftCo",
            job_title="Product Manager",
            status=ApplicationStatus.APPROVED,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        app_id = row.id

    r = client.post(f"/applications/{app_id}/submit", headers=headers)
    assert r.status_code == 409, r.text
    assert "draft" in r.json()["detail"].lower()

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == app_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_submitted_application_draft_cannot_be_edited() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    with SessionLocal() as db:
        row = Application(
            user_id=user_id,
            company="SentCo",
            job_title="Product Manager",
            status=ApplicationStatus.SUBMITTED,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        draft = OutreachDraft(application_id=row.id, channel="email", content="Already sent")
        db.add(draft)
        db.commit()
        db.refresh(draft)
        app_id = row.id
        draft_id = draft.id

    r = client.patch(
        f"/applications/drafts/{draft_id}",
        headers=headers,
        json={"content": "Change after send"},
    )
    assert r.status_code == 409, r.text

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.id == app_id))
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
    # Avoid real httpx to LinkedIn webhook when local .env sets
    # DOUBOW_LINKEDIN_DISPATCH_WEBHOOK_URL.
    monkeypatch.setattr(settings, "linkedin_dispatch_webhook_url", None)
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
        drafts = db.scalars(
            select(OutreachDraft).where(OutreachDraft.application_id == UUID(app_id))
        ).all()
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


def test_dispatch_outbound_resend_marks_email_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    """With Resend API key set, dispatch sends email via Resend (mocked HTTP) and marks the email draft SENT."""
    import httpx

    posts: list[dict] = []

    def fake_post(url: str, **kwargs):
        posts.append({"url": url, "json": kwargs.get("json")})
        return httpx.Response(200, json={"id": "re_x"})

    monkeypatch.setattr("app.tasks.httpx.post", fake_post)
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "resend_from", "Test <onboarding@resend.dev>")
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)
    monkeypatch.setattr(settings, "linkedin_dispatch_webhook_url", None)

    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Acme", "job_title": "PM", "source_url": "https://example.com/j2"},
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
    assert len(posts) == 1
    assert posts[0]["url"] == "https://api.resend.com/emails"
    assert posts[0]["json"]["from"] == "Test <onboarding@resend.dev>"

    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        assert posts[0]["json"]["to"] == [user.email]
        drafts = db.scalars(
            select(OutreachDraft).where(OutreachDraft.application_id == UUID(app_id))
        ).all()
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
