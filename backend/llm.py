"""Optional OpenAI-compatible completion. No key means the caller uses search."""

from __future__ import annotations

import json
import os
import re

import httpx

class LlmError(RuntimeError):
    pass


def configured() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def model_name() -> str | None:
    if not configured():
        return None
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"


def _endpoint() -> str:
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
    return f"{base}/chat/completions"


def _prompt(note: str, candidates: list[dict]) -> str:
    lines = []
    for row in candidates:
        primary = "primary" if row["valid_primary"] == "Y" else "not primary"
        pmb = ""
        if row.get("pmb"):
            pmb = f" | PMB {row['pmb']['code']}"
        lines.append(f"{row['code']} | {row['description']} | {primary}{pmb}")
    listed = "\n".join(lines)
    return (
        "You are coding a South African medical claim. Choose the 3 ICD-10 codes "
        "from the candidate list that best match the clinical note. Use only codes "
        "printed in the list. Do not invent codes, and do not change descriptions.\n"
        "Prefer a code marked primary. Prefer a more specific code over a .9 "
        "unspecified code when the note gives the detail that code needs.\n"
        "Each reason is one sentence citing the note.\n\n"
        f"Note:\n{note}\n\nCandidates:\n{listed}\n\n"
        'Return JSON: {"suggestions":[{"code":"E11.2","reason":"..."}]}'
    )


def _parse(content: str) -> list[dict]:
    text = content.strip()
    fenced = re.search(r"\{.*\}", text, re.S)
    if not fenced:
        raise LlmError("The model did not return JSON.")
    payload = json.loads(fenced.group(0))
    items = payload.get("suggestions") or payload.get("codes") or []
    if not isinstance(items, list):
        raise LlmError("The model JSON had no suggestion list.")
    cleaned = []
    for item in items:
        if isinstance(item, str):
            cleaned.append({"code": item, "reason": ""})
        elif isinstance(item, dict) and item.get("code"):
            cleaned.append({"code": str(item["code"]), "reason": str(item.get("reason") or "")})
    return cleaned


def complete(note: str, candidates: list[dict]) -> list[dict]:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise LlmError("OPENAI_API_KEY is not set.")
    if not candidates:
        return []
    body = {
        "model": model_name(),
        "temperature": 0,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": "You only return JSON. You never invent ICD-10 codes."},
            {"role": "user", "content": _prompt(note, candidates)},
        ],
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    timeout = httpx.Timeout(6.5, connect=3.0)
    with httpx.Client(timeout=timeout) as client:
        response = client.post(_endpoint(), headers=headers, json={**body, "response_format": {"type": "json_object"}})
        if response.status_code == 400:
            response = client.post(_endpoint(), headers=headers, json=body)
        if response.status_code >= 400:
            raise LlmError(f"Language model request failed ({response.status_code}).")
        data = response.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LlmError("Language model response had no message.") from exc
    return _parse(content)
