"""The findings format shared with the web app (Plan B.2).

docs/reader-contract.md describes it. web/src/findings/types.ts is the same
format in TypeScript, and both are tested against tests/fixtures/. Changing it
needs agreement from both the web app and the reader sides.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Box = Annotated[list[float], Field(min_length=4, max_length=4)]
Side = Literal["left", "right", ""]
Certainty = Literal["certain", "uncertain"]
Status = Literal["placed", "outside_coverage", "side_not_stated", "bone_not_stated"]
RefusalCode = Literal["not_pdf", "too_large", "too_many_pages", "no_text"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class PdfWording(_Strict):
    """A piece of report wording on a PDF page."""

    page: Annotated[int, Field(ge=1)]
    boxes: Annotated[list[Box], Field(min_length=1)]
    text: str


class TextWording(_Strict):
    """A piece of pasted report wording, as a character range in `text`."""

    start: Annotated[int, Field(ge=0)]
    end: Annotated[int, Field(ge=0)]
    text: str


class Finding(_Strict):
    bone: str
    side: Side
    part: list[str]
    type_words: list[str]
    certainty: Certainty
    healing_words: list[str]
    status: Status
    wording: list[PdfWording | TextWording]
    entered_by_patient: bool


class ReadResponse(_Strict):
    text: str
    exam_date: str | None
    candidate_dates: list[str]
    findings: list[Finding]


class Refusal(_Strict):
    refusal: RefusalCode
    message: str


def is_iso_date(value: str) -> bool:
    """Say whether a value is a calendar date written as YYYY-MM-DD."""
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False
