"""The report reader service (Project Plan, Milestone 2)."""

from fastapi import FastAPI

app = FastAPI(title="BoneScan report reader")


@app.get("/health")
def health() -> dict[str, str]:
    """Report that the service is up. The web app also calls this to wake it."""
    return {"status": "ok"}
