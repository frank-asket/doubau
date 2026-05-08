from uuid import uuid4

from app.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    password = "correct-horse-battery"
    pw_hash = hash_password(password)
    assert verify_password(password, pw_hash)
    assert not verify_password("wrong password", pw_hash)


def test_jwt_roundtrip() -> None:
    user_id = uuid4()
    token = create_access_token(user_id=user_id, email="test@example.com")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == "test@example.com"

