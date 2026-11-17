#!/usr/bin/env bash
# One command: FastAPI on 8741 and the Next.js UI on 4317.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8741 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT INT TERM
exec npm run dev
