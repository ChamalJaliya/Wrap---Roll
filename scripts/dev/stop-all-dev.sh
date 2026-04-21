#!/usr/bin/env bash
# Stop local dev servers (Next.js + Nest + Metro) on default ports.
set -euo pipefail

for port in 3000 3001 3002 3003 3004 4000 8081; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    kill -9 ${pids} 2>/dev/null || true
    echo "Stopped listeners on port ${port}"
  fi
done

pkill -f "next dev" 2>/dev/null || true
pkill -f "nx serve api" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true

echo "All dev ports cleared (3000–3004, 4000, 8081)."
