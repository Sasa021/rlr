"""FastAPI service for RLR. The Next.js app proxies /api to this process."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.db import manifest
from backend.llm import configured, model_name
from backend.store import add, list_recent
from backend.suggest import suggest_codes
from backend.validate import assess, pmb_for

app = FastAPI(title="RLR", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=4000)


class ConfirmIn(BaseModel):
    note: str = Field(min_length=1, max_length=4000)
    code: str = Field(min_length=1, max_length=16)
    mode: str = Field(default="search", max_length=16)


@app.get("/api/status")
def status() -> dict:
    info = manifest()
    return {
        "configuredMode": "llm" if configured() else "search",
        "model": model_name(),
        "mit": info["mit"],
        "pmb": {
            "name": info["pmb"]["name"],
            "distributionTitle": info["pmb"]["distributionTitle"],
            "distributionUpdated": info["pmb"]["distributionUpdated"],
            "workbookTitle": info["pmb"]["workbookTitle"],
            "page": info["pmb"]["page"],
            "note": info["pmb"]["note"],
        },
        "counts": info["counts"],
    }


@app.post("/api/suggest")
def suggest(body: NoteIn) -> dict:
    return suggest_codes(body.note)


@app.get("/api/confirmations")
def confirmations() -> dict:
    return {"confirmations": list_recent()}


@app.post("/api/confirmations")
def confirm(body: ConfirmIn) -> dict:
    verdict = assess(body.code)
    if not verdict.ok or verdict.row is None:
        raise HTTPException(status_code=422, detail={"message": verdict.reason, "code": verdict.code})
    row = dict(verdict.row)
    row["pmb"] = pmb_for(row["code"], row["description"], body.note)
    mode = body.mode if body.mode in {"llm", "search"} else "search"
    return add(body.note, row, mode)
