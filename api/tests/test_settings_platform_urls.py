from __future__ import annotations

from app.core import settings as settings_module
from app.core.settings import Settings


def test_database_url_falls_back_to_platform_database_url(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://railway:secret@postgres.railway.internal:5432/db")

    settings = Settings(_env_file=None, database_url="")

    assert (
        settings.database_url
        == "postgresql+psycopg://railway:secret@postgres.railway.internal:5432/db"
    )


def test_redis_url_falls_back_to_platform_redis_url(monkeypatch) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://default:secret@redis.railway.internal:6379")

    settings = Settings(_env_file=None, redis_url="")

    assert settings.redis_url == "redis://default:secret@redis.railway.internal:6379"


def test_redis_url_uses_platform_url_for_local_container_default(monkeypatch) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://default:secret@redis.railway.internal:6379")
    monkeypatch.setattr(settings_module, "_running_in_container", lambda: True)

    settings = Settings(_env_file=None, redis_url="redis://redis:6379/0")

    assert settings.redis_url == "redis://default:secret@redis.railway.internal:6379"
