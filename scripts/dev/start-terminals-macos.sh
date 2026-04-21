#!/usr/bin/env bash
# macOS only: ensure Redis, then open Terminal.app with one tab per service (API + 5 Next + iOS Simulator via Expo).
# Optional Metro-only mobile tab: npm run dev:terminals:mobile
# Run from repo root: bash scripts/dev/start-terminals-macos.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script is for macOS Terminal.app only."
  echo "On Linux/Windows, open terminals manually and run:"
  echo "  npm run ensure:redis:local"
  echo "  npm run start:api"
  echo "  npm run start:client | start:admin | start:cashier | start:kitchen | start:delivery"
  echo "Mobile (optional): npm run start:mobile"
  exit 1
fi

cd "$ROOT"
npm run ensure:redis:local

# Escape single quotes for AppleScript string literal
ROOT_ESC="${ROOT//\'/\'\'}"

osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "cd '${ROOT_ESC}' && echo '=== API :4000 ===' && npm run start:api"
    do script "cd '${ROOT_ESC}' && echo '=== Client :3000 ===' && npm run start:client"
    do script "cd '${ROOT_ESC}' && echo '=== Admin :3001 ===' && npm run start:admin"
    do script "cd '${ROOT_ESC}' && echo '=== Cashier :3002 ===' && npm run start:cashier"
    do script "cd '${ROOT_ESC}' && echo '=== Kitchen :3003 ===' && npm run start:kitchen"
    do script "cd '${ROOT_ESC}' && echo '=== Delivery :3004 ===' && npm run start:delivery"
    do script "cd '${ROOT_ESC}' && echo '=== Mobile iOS (Simulator) ===' && npm run start:mobile:ios"
end tell
APPLESCRIPT

echo "Redis ensured; opened Terminal with 7 tabs (API, 5 web apps, mobile iOS). Metro-only: npm run dev:terminals:mobile"
