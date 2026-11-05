"""The scoring script, run on the fictional Requirements Appendix B reports."""

import json
import shutil
import time
from pathlib import Path

from app.main import read_pdf
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
