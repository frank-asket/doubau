from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from docx import Document
from pypdf import PdfReader


@dataclass(frozen=True, slots=True)
class ResumeParseError(RuntimeError):
    message: str

    def __str__(self) -> str:  # pragma: no cover
        return self.message


def parse_pdf_bytes(data: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(data))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text)
        return "\n\n".join(parts).strip()
    except Exception as e:  # pragma: no cover
        raise ResumeParseError(f"Failed to parse PDF: {e!r}") from e


def parse_docx_bytes(data: bytes) -> str:
    try:
        doc = Document(BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
        return "\n".join(parts).strip()
    except Exception as e:  # pragma: no cover
        raise ResumeParseError(f"Failed to parse DOCX: {e!r}") from e

