"""POST /read: the file checks, the sign-in checks, and word positions."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from loguru import logger

from app import main, pdf
from app.auth import token_is_valid
from app.contract import ReadResponse
from app.pdf import extract_pdf, wording_on_pages
from tests.pdf_builder import build_pdf

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
ORIGIN = {"Origin": "http://localhost:5173"}
SIGNED_IN = {**ORIGIN, "Authorization": "Bearer good-token"}
REPORT = (FIXTURES / "report-b1.txt").read_text().rstrip("\n")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "token_is_valid", lambda token: token == "good-token")
    return TestClient(main.app)


def post_pdf(client, data: bytes, name: str = "report.pdf"):
    return client.post(
        "/read", headers=SIGNED_IN, files={"file": (name, data, "application/pdf")}
    )


def test_pdf_returns_its_text(client):
    response = post_pdf(client, (FIXTURES / "report-b1.pdf").read_bytes())
    assert response.status_code == 200
    assert ReadResponse.model_validate(response.json()).text == REPORT


def test_pasted_text_is_returned_unchanged(client):
    pasted = "  EXAM: XR WRIST LEFT\n\nFINDINGS: Normal.  \n"
    response = client.post("/read", headers=SIGNED_IN, data={"text": pasted})
    assert response.status_code == 200
    assert response.json()["text"] == pasted


@pytest.mark.parametrize(
    "data, name, code",
    [
        (b"PK\x03\x04 this is a Word file", "report.docx", "not_pdf"),
        (b"%PDF-1.4 damaged", "report.pdf", "not_pdf"),
        (b"%PDF-1.4" + b"0" * (10 * 1024 * 1024), "report.pdf", "too_large"),
        (b"%PDF-1.4" + b"0" * (11 * 1024 * 1024), "report.pdf", "too_large"),
        (build_pdf([["FINDINGS: Normal."]] * 11), "report.pdf", "too_many_pages"),
        (build_pdf([[]]), "report.pdf", "no_text"),
    ],
    ids=["word-file", "damaged", "just-over-10-mb", "11-mb", "11-pages", "no-text"],
)
def test_files_that_fail_a_check_are_refused(client, data, name, code):
    response = post_pdf(client, data, name)
    assert response.status_code == 422
    assert response.json()["refusal"] == code
    assert response.json()["message"] == pdf.REFUSAL_MESSAGES[code]


def test_a_10_page_pdf_is_accepted(client):
    data = build_pdf([["FINDINGS: Normal."]] * 10)
    assert post_pdf(client, data).status_code == 200


def test_blank_pasted_text_is_refused(client):
    response = client.post("/read", headers=SIGNED_IN, data={"text": "  \n "})
    assert response.status_code == 422
    assert response.json()["refusal"] == "no_text"


@pytest.mark.parametrize(
    "kwargs",
    [{}, {"data": {"text": "x"}, "files": {"file": ("a.pdf", b"%PDF-", "application/pdf")}}],
    ids=["neither", "both"],
)
def test_request_needs_exactly_one_report(client, kwargs):
    assert client.post("/read", headers=SIGNED_IN, **kwargs).status_code == 422


@pytest.mark.parametrize(
    "headers",
    [
        ORIGIN,
        {**ORIGIN, "Authorization": "Bearer wrong-token"},
        {**ORIGIN, "Authorization": "Basic good-token"},
    ],
    ids=["no-token", "wrong-token", "wrong-scheme"],
)
def test_request_without_a_good_token_is_refused(client, headers):
    assert client.post("/read", headers=headers, data={"text": "x"}).status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {"Authorization": "Bearer good-token"},
        {"Origin": "https://elsewhere.example", "Authorization": "Bearer good-token"},
    ],
    ids=["no-origin", "other-site"],
)
def test_request_from_another_site_is_refused(client, headers):
    assert client.post("/read", headers=headers, data={"text": "x"}).status_code == 403


def test_tokens_are_refused_when_supabase_is_not_configured(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    assert token_is_valid("good-token") is False


def test_health_stays_open():
    assert TestClient(main.app).get("/health").status_code == 200


def test_report_text_stays_out_of_the_logs(client, capfd, caplog):
    """Reading a report must not write its words anywhere."""
    caplog.set_level("DEBUG")
    assert not logger._core.handlers
    post_pdf(client, (FIXTURES / "report-b1.pdf").read_bytes())
    client.post("/read", headers=SIGNED_IN, data={"text": REPORT})
    out, err = capfd.readouterr()
    for written in (out, err, caplog.text):
        assert "metaphysis" not in written
        assert "outstretched" not in written


def test_wording_gets_one_box_per_line():
    extracted = extract_pdf((FIXTURES / "report-b1.pdf").read_bytes())
    start = extracted.text.index("There is a transverse")
    end = extracted.text.index("angulation.") + len("angulation.")
    [piece] = wording_on_pages(extracted, start, end)
    assert piece.page == 1
    assert len(piece.boxes) == 2
    assert piece.text == (
        "There is a transverse fracture of the distal radial metaphysis "
        "with mild dorsal angulation."
    )


def test_wording_across_a_page_break_becomes_two_pieces():
    extracted = extract_pdf(build_pdf([["The fracture of the"], ["left radius."]]))
    pieces = wording_on_pages(extracted, 0, len(extracted.text))
    assert [p.page for p in pieces] == [1, 2]
    assert [p.text for p in pieces] == ["The fracture of the", "left radius."]


def test_boxes_are_measured_from_the_displayed_page_when_cropped():
    lines = REPORT.split("\n")
    plain = extract_pdf(build_pdf([lines]))
    cropped = extract_pdf(build_pdf([lines], "/CropBox [36 36 576 756]"))
    assert cropped.text == plain.text
    for before, after in zip(plain.words, cropped.words):
        assert after.box[0] == pytest.approx(before.box[0] - 36)
        assert after.box[1] == pytest.approx(before.box[1] - 36)


@pytest.mark.parametrize(
    "rotation, margin_x, margin_y",
    [(0, 40, 32), (90, 500, 40), (180, 52, 500), (270, 32, 52)],
)
def test_boxes_follow_the_crop_at_every_rotation(rotation, margin_x, margin_y):
    """The expected margins were checked against PDF.js renders in Chromium."""
    lines = REPORT.split("\n")
    plain = extract_pdf(build_pdf([lines], f"/Rotate {rotation}"))
    cropped = extract_pdf(
        build_pdf([lines], f"/CropBox [40 500 560 760] /Rotate {rotation}")
    )
    for before, after in zip(plain.words, cropped.words):
        assert after.box[0] == pytest.approx(before.box[0] - margin_x)
        assert after.box[1] == pytest.approx(before.box[1] - margin_y)
