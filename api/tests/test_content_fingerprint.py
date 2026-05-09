from app.jobs.providers.fingerprint import content_fingerprint_sha256


def test_content_fingerprint_normalizes_spacing_and_case() -> None:
    a = content_fingerprint_sha256(title=" Software Engineer ", company=" ACME ", location="UK")
    b = content_fingerprint_sha256(title="software engineer", company="acme", location="uk")
    assert a == b
