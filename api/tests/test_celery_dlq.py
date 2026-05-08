from app.tasks import push_to_dlq


def test_push_to_dlq_no_crash() -> None:
    # Best-effort: we only guarantee it doesn't raise in unit tests.
    push_to_dlq({"hello": "world"})

