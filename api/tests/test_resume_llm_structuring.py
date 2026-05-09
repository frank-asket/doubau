from __future__ import annotations

import types

import pytest

from app.core.settings import settings
from app.resume.llm_structure import (
    ResumeLLMStructureError,
    llm_structure_resume_text,
    openai_structure_resume_text,
)
from app.tasks import _run_llm_resume_structure


def test_llm_structure_disabled_raises() -> None:
    prev = settings.resume_llm_structuring_enabled
    settings.resume_llm_structuring_enabled = False
    try:
        with pytest.raises(ResumeLLMStructureError):
            llm_structure_resume_text("hello")
    finally:
        settings.resume_llm_structuring_enabled = prev


def test_llm_structure_parses_json(monkeypatch: pytest.MonkeyPatch) -> None:
    prev_enabled = settings.resume_llm_structuring_enabled
    prev_key = settings.openai_api_key
    settings.resume_llm_structuring_enabled = True
    settings.openai_api_key = "test"

    class _FakeClient:
        def __init__(self, api_key: str) -> None:
            self.api_key = api_key

        class chat:  # noqa: N801
            class completions:  # noqa: N801
                @staticmethod
                def create(**_kwargs):  # type: ignore[no-untyped-def]
                    msg = types.SimpleNamespace(content='{"name":"Ada","skills":["python"]}')
                    choice = types.SimpleNamespace(message=msg)
                    return types.SimpleNamespace(choices=[choice])

    monkeypatch.setattr("app.resume.llm_structure.OpenAI", _FakeClient)

    try:
        out = llm_structure_resume_text("Ada has Python experience.")
        assert out["name"] == "Ada"
        assert out["skills"] == ["python"]
    finally:
        settings.resume_llm_structuring_enabled = prev_enabled
        settings.openai_api_key = prev_key


def test_openai_structure_resume_text_no_enabled_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    prev_key = settings.openai_api_key
    prev_enabled = settings.resume_llm_structuring_enabled
    settings.openai_api_key = "test"
    settings.resume_llm_structuring_enabled = False

    class _FakeClient:
        def __init__(self, api_key: str) -> None:
            self.api_key = api_key

        class chat:  # noqa: N801
            class completions:  # noqa: N801
                @staticmethod
                def create(**_kwargs):  # type: ignore[no-untyped-def]
                    msg = types.SimpleNamespace(content='{"name":"Bob"}')
                    choice = types.SimpleNamespace(message=msg)
                    return types.SimpleNamespace(choices=[choice])

    monkeypatch.setattr("app.resume.llm_structure.OpenAI", _FakeClient)

    try:
        out = openai_structure_resume_text("hello")
        assert out["name"] == "Bob"
    finally:
        settings.openai_api_key = prev_key
        settings.resume_llm_structuring_enabled = prev_enabled


def test_claude_structure_parses_json(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.resume.claude_structure import claude_structure_resume_text

    prev_key = settings.anthropic_api_key
    settings.anthropic_api_key = "test-ant"

    class _FakeResp:
        status_code = 200

        def json(self) -> dict:
            return {"content": [{"type": "text", "text": '{"name":"Ada","skills":["rust"]}'}]}

    class _FakeClient:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        def __enter__(self) -> _FakeClient:
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def post(self, *_a: object, **_k: object) -> _FakeResp:
            return _FakeResp()

    monkeypatch.setattr("app.resume.claude_structure.httpx.Client", _FakeClient)

    try:
        out = claude_structure_resume_text("Ada codes Rust.")
        assert out["name"] == "Ada"
        assert out["skills"] == ["rust"]
    finally:
        settings.anthropic_api_key = prev_key


def test_run_llm_resume_structure_auto_prefers_claude(monkeypatch: pytest.MonkeyPatch) -> None:
    prev_prov = settings.resume_structuring_provider
    prev_a = settings.anthropic_api_key
    prev_o = settings.openai_api_key
    settings.resume_structuring_provider = "auto"
    settings.anthropic_api_key = "a"
    settings.openai_api_key = "o"

    monkeypatch.setattr(
        "app.tasks.claude_structure_resume_text",
        lambda _t: {"name": "ClaudeUser"},
    )

    try:
        out = _run_llm_resume_structure("x")
        assert out["_provider"] == "claude"
        assert out["name"] == "ClaudeUser"
    finally:
        settings.resume_structuring_provider = prev_prov
        settings.anthropic_api_key = prev_a
        settings.openai_api_key = prev_o


def test_run_llm_auto_fallback_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    prev_prov = settings.resume_structuring_provider
    prev_a = settings.anthropic_api_key
    prev_o = settings.openai_api_key
    settings.resume_structuring_provider = "auto"
    settings.anthropic_api_key = "a"
    settings.openai_api_key = "o"

    def _fail(_t: str) -> dict[str, object]:
        raise ResumeLLMStructureError("claude down")

    monkeypatch.setattr("app.tasks.claude_structure_resume_text", _fail)
    monkeypatch.setattr(
        "app.tasks.openai_structure_resume_text",
        lambda _t: {"headline": "Engineer"},
    )

    try:
        out = _run_llm_resume_structure("x")
        assert out["_provider"] == "openai"
        assert out["headline"] == "Engineer"
    finally:
        settings.resume_structuring_provider = prev_prov
        settings.anthropic_api_key = prev_a
        settings.openai_api_key = prev_o

