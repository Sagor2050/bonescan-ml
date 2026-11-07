"""The report reader service (Project Plan, Milestone 2)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile

from app import logging_setup  # noqa: F401
from app.auth import allowed_origins, token_is_valid, warn_about_missing_settings
from app.contract import ReadResponse, Refusal
from app.pdf import (
    MAX_BYTES,
    REFUSAL_MESSAGES,
    ReportRefused,
    extract_pdf,
    wording_on_pages,
)
from app.reading import read_report

# Room for the multipart wrapper around a file that is exactly at the limit.
MULTIPART_OVERHEAD = 64 * 1024


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    warn_about_missing_settings()
    yield


app = FastAPI(title="BoneScan report reader", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Report that the service is up. The web app also calls this to wake it."""
    return {"status": "ok"}


async def require_signed_in_user(request: Request) -> None:
    if request.headers.get("origin") not in allowed_origins():
        raise HTTPException(status_code=403, detail="Not from an allowed site.")
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    is_valid = scheme.lower() == "bearer" and await run_in_threadpool(
        token_is_valid, token
    )
    if not is_valid:
        raise HTTPException(status_code=401, detail="Sign in first.")


def refusal_response(error: ReportRefused) -> JSONResponse:
    refusal = Refusal(refusal=error.code, message=REFUSAL_MESSAGES[error.code])
    return JSONResponse(status_code=422, content=refusal.model_dump())


def read_pasted(text: str) -> ReadResponse:
    if not text.strip():
        raise ReportRefused("no_text")
    reading = read_report(text)
    return ReadResponse(
        text=text,
        exam_date=reading.exam_date,
        candidate_dates=reading.candidate_dates,
        findings=reading.findings,
    )


def read_pdf(data: bytes) -> ReadResponse:
    extracted = extract_pdf(data)
    reading = read_report(
        extracted.text, lambda start, end: wording_on_pages(extracted, start, end)
    )
    return ReadResponse(
        text=extracted.text,
        exam_date=reading.exam_date,
        candidate_dates=reading.candidate_dates,
        findings=reading.findings,
    )


@app.post(
    "/read",
    response_model=ReadResponse,
    dependencies=[Depends(require_signed_in_user)],
)
async def read(request: Request):
    """Read a report and forget it. Nothing is stored or logged (Key Decision 5)."""
    content_length = request.headers.get("content-length", "")
    if content_length.isdigit() and int(content_length) > MAX_BYTES + MULTIPART_OVERHEAD:
        return refusal_response(ReportRefused("too_large"))

    async with request.form() as form:
        file, text = form.get("file"), form.get("text")
        if (file is None) == (text is None):
            raise HTTPException(status_code=422, detail="Send a file or text.")
        try:
            if isinstance(file, UploadFile):
                data = await file.read(MAX_BYTES + 1)
                return await run_in_threadpool(read_pdf, data)
            if isinstance(text, str):
                return await run_in_threadpool(read_pasted, text)
        except ReportRefused as error:
            return refusal_response(error)
    raise HTTPException(status_code=422, detail="Send a file or text.")
