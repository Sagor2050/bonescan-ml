"""The scoring script, run on the fictional Requirements Appendix B reports."""

import json
import shutil
import time
from pathlib import Path

import pytest

from app.main import read_pdf
from scoring import score as scoring
from scoring.score import main, score_folder
from tests.pdf_builder import build_pdf

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
RADIUS_LEFT = {"bone": "radius", "side": "left"}


def add_key(folder: Path, name: str, fractures: list[dict]) -> None:
    (folder / f"{name}.json").write_text(json.dumps({"fractures": fractures}))


def test_appendix_b_reports_score_perfectly(tmp_path):
    shutil.copy(FIXTURES / "report-b1.pdf", tmp_path / "b1.pdf")
    shutil.copy(FIXTURES / "report-b2.txt", tmp_path / "b2.txt")
    add_key(tmp_path, "b1", [RADIUS_LEFT])
    add_key(tmp_path, "b2", [RADIUS_LEFT])
    score = score_folder(tmp_path)
    assert (score.reports, score.found, score.stated, score.wrong) == (2, 2, 2, 0)
    assert score.passes


def test_a_finding_on_the_wrong_side_is_missed_and_wrong(tmp_path):
    (tmp_path / "a.txt").write_text("FINDINGS: Left radius fracture.")
    add_key(tmp_path, "a", [{"bone": "radius", "side": "right"}])
    score = score_folder(tmp_path)
    assert (score.found, score.stated, score.wrong) == (0, 1, 1)
    assert not score.passes


def test_a_missed_fracture_lowers_found(tmp_path):
    (tmp_path / "a.txt").write_text("FINDINGS: Normal.")
    add_key(tmp_path, "a", [RADIUS_LEFT])
    score = score_folder(tmp_path)
    assert (score.found, score.stated, score.findings) == (0, 1, 0)


def test_a_finding_the_report_does_not_state_is_wrong(tmp_path):
    (tmp_path / "a.txt").write_text("FINDINGS: Left radius fracture.")
    add_key(tmp_path, "a", [])
    score = score_folder(tmp_path)
    assert (score.findings, score.wrong) == (1, 1)


def test_a_refused_report_counts_its_fractures_as_missed(tmp_path):
    (tmp_path / "a.pdf").write_bytes(build_pdf([[]]))
    add_key(tmp_path, "a", [RADIUS_LEFT])
    score = score_folder(tmp_path)
    assert (score.refused, score.found, score.stated) == (1, 0, 1)


def test_output_never_includes_report_text(tmp_path, capsys, monkeypatch):
    (tmp_path / "a.txt").write_text("FINDINGS: Left radius fracture, fictional-word.")
    add_key(tmp_path, "a", [RADIUS_LEFT])
    monkeypatch.setattr("sys.argv", ["score", str(tmp_path)])
    assert main() == 0
    out, err = capsys.readouterr()
    assert "fictional-word" not in out + err
    assert "PASS" in out


def test_a_10_page_report_is_fast_enough():
    """NFR1, measured here for the reader's part only."""
    lines = (FIXTURES / "report-b1.txt").read_text().rstrip("\n").split("\n")
    page = (lines * 5)[:40]
    started = time.perf_counter()
    read_pdf(build_pdf([page] * 10))
    assert time.perf_counter() - started < 10


def run_main(folder, monkeypatch, capsys) -> tuple[int, str]:
    monkeypatch.setattr("sys.argv", ["score", str(folder)])
    code = main()
    captured = capsys.readouterr()
    return code, captured.out + captured.err


def test_a_report_with_no_key_stops_a_pass(tmp_path, monkeypatch, capsys):
    (tmp_path / "scored.txt").write_text("FINDINGS: Left radius fracture.")
    add_key(tmp_path, "scored", [RADIUS_LEFT])
    (tmp_path / "forgotten.txt").write_text("FINDINGS: Left ulna fracture.")
    code, output = run_main(tmp_path, monkeypatch, capsys)
    assert code == 1
    assert "forgotten: problem, no answer key" in output
    assert "NOT YET" in output


def test_a_key_with_no_report_stops_a_pass(tmp_path, monkeypatch, capsys):
    (tmp_path / "scored.txt").write_text("FINDINGS: Left radius fracture.")
    add_key(tmp_path, "scored", [RADIUS_LEFT])
    add_key(tmp_path, "lonely", [RADIUS_LEFT])
    code, output = run_main(tmp_path, monkeypatch, capsys)
    assert code == 1
    assert "lonely: problem, no report" in output


@pytest.mark.parametrize(
    "key, message",
    [
        ('{"fractures": [{"bone"', "isn't valid JSON"),
        ("[]", 'no "fractures" list'),
        ('{"fractures": [{"bone": "radius"}]}', 'needs a "bone" and a "side"'),
        ('{"fractures": [{"bone": "radiuss", "side": "left"}]}', "isn't in bones.json"),
        ('{"fractures": [{"bone": "radius", "side": "L"}]}', "a side other than"),
        ('{"fractures": [{"bone": "radius_left", "side": "left"}]}', "isn't in bones.json"),
    ],
)
def test_a_mistake_in_a_key_is_not_scored_against_the_reader(
    tmp_path, monkeypatch, capsys, key, message
):
    (tmp_path / "a.txt").write_text("FINDINGS: Left radius fracture.")
    (tmp_path / "a.json").write_text(key)
    (tmp_path / "b.txt").write_text("FINDINGS: Left radius fracture.")
    add_key(tmp_path, "b", [RADIUS_LEFT])
    score = score_folder(tmp_path)
    output = capsys.readouterr().out
    assert message in output
    assert "b: 1/1 found" in output
    assert (score.reports, score.stated, score.wrong, score.problems) == (1, 1, 0, 1)
    assert not score.passes


def test_a_reader_failure_prints_only_its_type(tmp_path, monkeypatch, capsys):
    report_words = "FICTIONAL-WORDS-THAT-MUST-NOT-PRINT"

    def fails(text):
        raise ValueError(f"could not read {text}")

    monkeypatch.setattr(scoring, "read_pasted", fails)
    (tmp_path / "a.txt").write_text(f"FINDINGS: {report_words}")
    add_key(tmp_path, "a", [RADIUS_LEFT])
    code, output = run_main(tmp_path, monkeypatch, capsys)
    assert code == 1
    assert "a: problem, the reader failed (ValueError)" in output
    assert report_words not in output
    assert "Found with the right bone and side: 0/1" in output


def test_an_empty_folder_never_shows_a_perfect_score(tmp_path, monkeypatch, capsys):
    code, output = run_main(tmp_path, monkeypatch, capsys)
    assert code == 1
    assert "No reports could be scored" in output
    assert "100" not in output


def test_a_missing_folder_says_so(tmp_path, monkeypatch, capsys):
    code, output = run_main(tmp_path / "nowhere", monkeypatch, capsys)
    assert code == 1
    assert "doesn't exist" in output
