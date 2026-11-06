"""Get the text out of a PDF, along with where each word sits on the page."""

import io
from dataclasses import dataclass

import pdfplumber

from app import logging_setup  # noqa: F401
from app.contract import PdfWording, RefusalCode

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 10
LINE_TOLERANCE = 3

REFUSAL_MESSAGES: dict[RefusalCode, str] = {
    "not_pdf": (
        "This file isn't a PDF we can open, so it wasn't added. "
        "You can add a PDF or paste the report text instead."
    ),
    "too_large": "This file is over the 10 MB limit, so it wasn't added.",
    "too_many_pages": "This file has more than 10 pages, so it wasn't added.",
    "no_text": (
        "We couldn't find any text in this file, so it wasn't added. "
        "It may be a scanned report. You can paste the report text instead."
    ),
}


class ReportRefused(Exception):
    """The report fails a file check, so nothing is read or kept."""

    def __init__(self, code: RefusalCode):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Word:
    """A word's place in the extracted text and on its page."""

    page: int
    line: int
    start: int
    end: int
    box: tuple[float, float, float, float]


@dataclass(frozen=True)
class ExtractedPdf:
    text: str
    words: list[Word]


def _crop_margins(page) -> tuple[float, float]:
    """Find how far the displayed page starts from pdfplumber's origin.

    pdfplumber measures from the MediaBox, but PDF.js shows only the CropBox.
    This uses the file's own boxes, because pdfplumber's turned copies are the
    same for 90 and 270 degrees, and gives the margins as the page is displayed.
    """
    media, crop = page.page_obj.mediabox, page.page_obj.cropbox
    left = crop[0] - media[0]
    bottom = crop[1] - media[1]
    right = media[2] - crop[2]
    top = media[3] - crop[3]
    return {
        90: (bottom, left),
        180: (right, bottom),
        270: (top, right),
    }.get(page.rotation % 360, (left, top))


def extract_pdf(data: bytes) -> ExtractedPdf:
    """Read a PDF's words, or raise ReportRefused if it fails a file check."""
    if len(data) > MAX_BYTES:
        raise ReportRefused("too_large")
    if b"%PDF-" not in data[:1024]:
        raise ReportRefused("not_pdf")
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            if len(pdf.pages) > MAX_PAGES:
                raise ReportRefused("too_many_pages")
            extracted = _read_pages(pdf.pages)
    except ReportRefused:
        raise
    except Exception as error:
        # A damaged or locked file. The error itself isn't logged, because it
        # could quote the file's content.
        raise ReportRefused("not_pdf") from error
    if not extracted.text.strip():
        raise ReportRefused("no_text")
    return extracted


def _read_pages(pages) -> ExtractedPdf:
    text = ""
    words: list[Word] = []
    line = -1
    for number, page in enumerate(pages, start=1):
        margin_x, margin_y = _crop_margins(page)
        line_top = None
        for item in page.extract_words():
            if line_top is None or abs(item["top"] - line_top) > LINE_TOLERANCE:
                if text:
                    text += "\n"
                line_top = item["top"]
                line += 1
            elif text:
                text += " "
            start = len(text)
            text += item["text"]
            words.append(
                Word(
                    page=number,
                    line=line,
                    start=start,
                    end=len(text),
                    box=(
                        round(item["x0"] - margin_x, 2),
                        round(item["top"] - margin_y, 2),
                        round(item["x1"] - margin_x, 2),
                        round(item["bottom"] - margin_y, 2),
                    ),
                )
            )
    return ExtractedPdf(text=text, words=words)


def wording_on_pages(extracted: ExtractedPdf, start: int, end: int) -> list[PdfWording]:
    """Turn a character range into wording with one box per line of text.

    Wording that crosses a page break becomes one piece per page.
    """
    chosen = [w for w in extracted.words if w.start < end and w.end > start]
    pieces: list[PdfWording] = []
    for page in sorted({w.page for w in chosen}):
        on_page = [w for w in chosen if w.page == page]
        boxes = []
        for line in sorted({w.line for w in on_page}):
            on_line = [w for w in on_page if w.line == line]
            boxes.append(
                [
                    min(w.box[0] for w in on_line),
                    min(w.box[1] for w in on_line),
                    max(w.box[2] for w in on_line),
                    max(w.box[3] for w in on_line),
                ]
            )
        text = " ".join(extracted.text[on_page[0].start : on_page[-1].end].split())
        pieces.append(PdfWording(page=page, boxes=boxes, text=text))
    return pieces
