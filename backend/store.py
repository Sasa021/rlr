"""Confirmation log. A separate SQLite file from the read-only MIT."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from backend.db import ROOT

SCHEMA = """
CREATE TABLE IF NOT EXISTS confirmations (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  note TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  valid_primary INTEGER NOT NULL,
  pmb_json TEXT,
  mode TEXT
);
"""


def path() -> Path:
    override = os.environ.get("RLR_CONFIRMATIONS_PATH", "").strip()
    return Path(override) if override else ROOT / "data" / "confirmations.sqlite"


def connect() -> sqlite3.Connection:
    target = path()
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    return conn


def add(note: str, row: dict, mode: str) -> dict:
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    pmb = row.get("pmb")
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO confirmations
              (created_at, note, code, description, valid_primary, pmb_json, mode)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created,
                note.strip(),
                row["code"],
                row["description"],
                1 if row["valid_primary"] == "Y" else 0,
                json.dumps(pmb) if pmb else None,
                mode,
            ),
        )
        conn.commit()
        saved_id = cursor.lastrowid
    return record(saved_id, created, note.strip(), row, mode)


def record(saved_id: int, created: str, note: str, row: dict, mode: str) -> dict:
    return {
        "id": saved_id,
        "createdAt": created,
        "note": note,
        "code": row["code"],
        "description": row["description"],
        "validPrimary": row["valid_primary"] == "Y",
        "pmb": row.get("pmb"),
        "mode": mode,
    }


def list_recent(limit: int = 20) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, note, code, description, valid_primary, pmb_json, mode
            FROM confirmations
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    items = []
    for row in rows:
        pmb = json.loads(row["pmb_json"]) if row["pmb_json"] else None
        items.append(
            {
                "id": row["id"],
                "createdAt": row["created_at"],
                "note": row["note"],
                "code": row["code"],
                "description": row["description"],
                "validPrimary": bool(row["valid_primary"]),
                "pmb": pmb,
                "mode": row["mode"],
            }
        )
    return items
