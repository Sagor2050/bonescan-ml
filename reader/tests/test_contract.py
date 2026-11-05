"""Check the shared sample responses against the findings format."""

import json
from pathlib import Path

import pdfplumber
import pytest
from pydantic import ValidationError

from app.contract import PdfWording, ReadResponse, Refusal, TextWording, is_iso_date

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "tests" / "fixtures"
SAMPLES = sorted(FIXTURES.glob("read-*.json"))
CATALOG = json.loads((REPO / "web/public/shared/bones.json").read_text())


def load(path: Path) -> ReadResponse:
    return ReadResponse.model_validate(json.loads(path.read_text()))


def test_all_four_samples_exist():
    assert [path.name for path in SAMPLES] == [
        "read-b1-pasted.json",
        "read-b1-pdf.json",
        "read-b2-pasted.json",
        "read-b2-pdf.json",
    ]


@pytest.mark.parametrize("path", SAMPLES, ids=lambda path: path.stem)
def test_sample_matches_its_report(path: Path):
    response = load(path)
    report = path.stem.split("-")[1]
    assert response.text == (FIXTURES / f"report-{report}.txt").read_text().rstrip("\n")
    assert response.exam_date is not None and is_iso_date(response.exam_date)
    assert response.candidate_dates == []


@pytest.mark.parametrize("path", SAMPLES, ids=lambda path: path.stem)
def test_sample_names_catalog_bones_and_parts(path: Path):
    for finding in load(path).findings:
        entry = next(e for e in CATALOG if e["id"] == f"{finding.bone}_{finding.side}")
        assert set(finding.part) <= set(entry["parts"])


@pytest.mark.parametrize(
    "path", [p for p in SAMPLES if "pasted" in p.stem], ids=lambda path: path.stem
)
def test_pasted_ranges_point_at_their_wording(path: Path):
    response = load(path)
    for finding in response.findings:
        for piece in finding.wording:
            assert isinstance(piece, TextWording)
            found = response.text[piece.start : piece.end]
            assert " ".join(found.split()) == piece.text


@pytest.mark.parametrize(
    "path", [p for p in SAMPLES if "pdf" in p.stem], ids=lambda path: path.stem
)
def test_pdf_boxes_cover_their_wording(path: Path):
    response = load(path)
    report = path.stem.split("-")[1]
    with pdfplumber.open(FIXTURES / f"report-{report}.pdf") as pdf:
        for finding in response.findings:
            for piece in finding.wording:
                assert isinstance(piece, PdfWording)
                page = pdf.pages[piece.page - 1]
                covered = " ".join(
                    page.crop(box, strict=False).extract_text().replace("\n", " ")
                    for box in piece.boxes
                )
                assert covered == piece.text


def test_format_refuses_unknown_fields():
    data = json.loads(SAMPLES[0].read_text())
    data["findings"][0]["guess"] = True
    with pytest.raises(ValidationError):
        ReadResponse.model_validate(data)


def test_format_refuses_unknown_status():
    data = json.loads(SAMPLES[0].read_text())
    data["findings"][0]["status"] = "maybe"
    with pytest.raises(ValidationError):
        ReadResponse.model_validate(data)


def test_refusal_codes_are_fixed():
    Refusal(refusal="too_large", message="This file is over 10 MB.")
    with pytest.raises(ValidationError):
        Refusal.model_validate({"refusal": "too_big", "message": "No."})
