from __future__ import annotations

from uuid import uuid4

from app.middleware.idempotency import _user_id_from_payload, _uuid_from_sub


class _FakeQuery:
    def __init__(self, row):
        self._row = row

    def filter(self, *_args):
        return self

    def one_or_none(self):
        return self._row


class _FakeDb:
    def __init__(self, row=None):
        self.row = row
        self.queries = 0

    def query(self, *_args):
        self.queries += 1
        return _FakeQuery(self.row)


def test_uuid_from_sub_accepts_uuid_string() -> None:
    uid = uuid4()
    assert _uuid_from_sub(str(uid)) == uid


def test_user_id_from_payload_uses_local_uuid_without_db_lookup() -> None:
    uid = uuid4()
    db = _FakeDb()

    assert _user_id_from_payload(db, {"sub": str(uid)}) == uid
    assert db.queries == 0


def test_user_id_from_payload_resolves_clerk_email_from_existing_user() -> None:
    uid = uuid4()
    db = _FakeDb(row=(uid,))

    assert _user_id_from_payload(db, {"sub": "user_123", "email": "a@example.com"}) == uid
    assert db.queries == 1


def test_user_id_from_payload_ignores_unknown_clerk_email() -> None:
    assert _user_id_from_payload(_FakeDb(row=None), {"sub": "user_123"}) is None
