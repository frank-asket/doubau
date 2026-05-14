"""POST /me/google/send-test-email — Gmail API connectivity (mocked)."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import engine
from app.main import app
from app.security import decode_access_token


@pytest.fixture
def postgres_client() -> TestClient:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")
    return TestClient(app)


def _signup(client: TestClient) -> str:
    email = f"gmail-test-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    decode_access_token(token)
    return token


def test_send_test_email_requires_gmail_connected(postgres_client: TestClient) -> None:
    token = _signup(postgres_client)
    r = postgres_client.post(
        "/me/google/send-test-email",
        headers={"Authorization": f"Bearer {token}"},
        json={"to": "asketsystem1@gmail.com"},
    )
    assert r.status_code == 400
    assert "Connect Gmail" in r.json().get("detail", "")


def test_send_test_email_ok_with_mock_row(postgres_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from uuid import UUID

    from app.models.user_google_token import UserGoogleToken

    monkeypatch.setattr(
        "app.api.me_google.google_oauth_configured",
        lambda: True,
    )
    token = _signup(postgres_client)
    payload = decode_access_token(token)
    uid = UUID(str(payload["sub"]))

    from app.db import SessionLocal

    db = SessionLocal()
    try:
        db.merge(
            UserGoogleToken(
                user_id=uid,
                refresh_ciphertext="dummy-cipher",
                google_account_email="sender@example.com",
            )
        )
        db.commit()
    finally:
        db.close()

    with patch("app.api.me_google.send_plaintext_email", return_value={"id": "msg-123abc"}):
        r = postgres_client.post(
            "/me/google/send-test-email",
            headers={"Authorization": f"Bearer {token}"},
            json={"to": "asketsystem1@gmail.com", "subject": "Test subject"},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["from_addr"] == "sender@example.com"
    assert data["to"] == "asketsystem1@gmail.com"
    assert data["gmail_message_id"] == "msg-123abc"

    db2 = SessionLocal()
    try:
        row = db2.get(UserGoogleToken, uid)
        if row is not None:
            db2.delete(row)
            db2.commit()
    finally:
        db2.close()
