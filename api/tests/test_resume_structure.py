from app.resume.structure import structure_resume_text


def test_structure_resume_text_detects_sections() -> None:
    raw = """Jane Doe\n\nExperience\nBuilt things.\n\nSkills\nPython\n"""
    out = structure_resume_text(raw)
    assert out["headline"] == "Jane Doe"
    assert "experience" in out["section_ids_found"]
    assert "skills" in out["section_ids_found"]
    assert out["word_count"] >= 4
