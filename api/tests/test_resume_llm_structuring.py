from __future__ import annotations

import types

import pytest

from app.core.settings import settings
from app.resume.llm_structure import ResumeLLMStructureError, llm_structure_resume_text


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

