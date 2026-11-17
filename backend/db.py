"""Read-only access to the ingested MIT and PMB tables."""

from __future__ import annotations

import sqlite3
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIT_PATH = ROOT / "data" / "mit.sqlite"
MANIFEST_PATH = ROOT / "data" / "manifest.json"


def connect() -> sqlite3.Connection:
    if not MIT_PATH.exists():
        raise FileNotFoundError(
            f"Missing {MIT_PATH}. Run `python scripts/ingest.py` to build it."
        )
    conn = sqlite3.connect(f"file:{MIT_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


@lru_cache(maxsize=1)
def manifest() -> dict:
    import json

    return json.loads(MANIFEST_PATH.read_text())


def today_yyyymmdd() -> str:
    from datetime import date

    return date.today().strftime("%Y%m%d")
