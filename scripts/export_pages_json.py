#!/usr/bin/env python3
"""Build data/mit.sqlite from the official workbooks, then write docs/codes.json.

The Pages bundle only needs suggestable MIT rows: code, description, and the
CMS PMB code when the listing is specific enough to show on a card.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DB = ROOT / "data" / "mit.sqlite"
OUT = ROOT / "docs" / "codes.json"
MIT_NAME = "ICD-10_MIT_2021_Excel_16-March_2021.xlsx"
PMB_NAME = "2026-pmb-icd-10-coded-list-distribution.xlsx"

# Broad CMS buckets. They stay in the database but are not the on-screen chip.
BROAD = {"909T", "903T"}


def cell(row: tuple, index: int):
    if index >= len(row):
        return None
    value = row[index]
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def yn(value) -> str:
    return "Y" if str(value or "").strip().upper() == "Y" else "N"


def end_text(value) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y%m%d")
    if isinstance(value, date):
        return value.strftime("%Y%m%d")
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return digits[:8] if len(digits) >= 8 else ""


def split_pmb_codes(raw: str) -> list[str]:
    text = raw.upper().replace(" ", "").replace("†", "").replace("‡", "").replace("*", "")
    parts = []
    for piece in text.replace(";", "+").split("+"):
        piece = piece.strip(".")
        if len(piece) >= 3 and piece[0].isalpha() and piece[1:3].isdigit():
            parts.append(piece)
    return parts


def load_mit(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["SA ICD-10 MIT 2021"]
    rows = []
    seen = set()
    today = date.today().strftime("%Y%m%d")
    for raw in ws.iter_rows(min_row=2, values_only=True):
        code = cell(raw, 7)
        description = cell(raw, 8)
        if not code or not description:
            continue
        code = str(code).strip().upper()
        if code in seen:
            continue
        seen.add(code)
        sa_end = end_text(cell(raw, 21))
        ended = bool(sa_end) and sa_end < today
        clinical = yn(cell(raw, 9))
        description = " ".join(str(description).split())
        rows.append(
            {
                "code": code,
                "description": description,
                "suggestable": int(clinical == "Y" and not ended),
            }
        )
    wb.close()
    return rows


def load_pmb(path: Path) -> list[tuple[str, str, str]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    current_code = ""
    current_desc = ""
    pairs = []
    seen = set()
    for raw in ws.iter_rows(min_row=12, values_only=True):
        pmb_code = cell(raw, 0)
        pmb_desc = cell(raw, 1)
        icd = cell(raw, 3)
        if pmb_code and icd:
            current_code = str(pmb_code).strip()
            current_desc = str(pmb_desc or "").strip()
        if not icd or not current_code:
            continue
        for code in split_pmb_codes(str(icd)):
            key = (code, current_code)
            if key in seen:
                continue
            seen.add(key)
            pairs.append((code, current_code, " ".join(current_desc.split())))
    wb.close()
    return pairs


def write_sqlite(codes: list[dict], pmb: list[tuple[str, str, str]]) -> None:
    if DB.exists():
        DB.unlink()
    DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.execute(
        """
        CREATE TABLE codes (
            code TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            suggestable INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE pmb (
            code TEXT NOT NULL,
            pmb_code TEXT NOT NULL,
            pmb_description TEXT NOT NULL
        )
        """
    )
    conn.executemany(
        "INSERT INTO codes (code, description, suggestable) VALUES (?, ?, ?)",
        [(row["code"], row["description"], row["suggestable"]) for row in codes],
    )
    known = {row["code"] for row in codes}
    linked = [row for row in pmb if row[0] in known]
    conn.executemany("INSERT INTO pmb (code, pmb_code, pmb_description) VALUES (?, ?, ?)", linked)
    conn.commit()
    conn.close()
    print(f"sqlite {DB} codes={len(codes)} pmb_links={len(linked)}")


def best_pmb(rows: list[tuple[str, str]]) -> str:
    """Prefer a specific listing over the broad CMS buckets."""
    specific = [code for code, _desc in rows if code not in BROAD]
    if specific:
        return specific[0]
    return ""


def export_json() -> None:
    conn = sqlite3.connect(DB)
    pmb_by_code: dict[str, list[tuple[str, str]]] = {}
    for code, pmb_code, pmb_desc in conn.execute("SELECT code, pmb_code, pmb_description FROM pmb"):
        pmb_by_code.setdefault(code, []).append((pmb_code, pmb_desc))
    payload = []
    for code, description in conn.execute(
        "SELECT code, description FROM codes WHERE suggestable = 1 ORDER BY code"
    ):
        flag = best_pmb(pmb_by_code.get(code, []))
        if flag:
            payload.append([code, description, flag])
        else:
            payload.append([code, description])
    conn.close()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"v": 1, "codes": payload}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(payload)} codes)")


def main() -> None:
    codes = load_mit(RAW / MIT_NAME)
    pmb = load_pmb(RAW / PMB_NAME)
    write_sqlite(codes, pmb)
    export_json()


if __name__ == "__main__":
    main()
