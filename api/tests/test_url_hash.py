from app.jobs.url_hash import hash_source_url, normalize_source_url


def test_normalize_source_url_stable() -> None:
    a = normalize_source_url("HTTPS://Example.COM/path/?b=2&a=1")
    b = normalize_source_url("https://example.com/path?a=1&b=2")
    assert a == b


def test_hash_source_url_deterministic() -> None:
    assert hash_source_url("https://jobs.example.com/o/abc?utm_source=x") == hash_source_url(
        "https://jobs.example.com/o/abc?utm_source=x"
    )
