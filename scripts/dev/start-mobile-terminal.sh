#!/usr/bin/env bash
# Open a single terminal with Expo / Metro for apps/mobile (port 8081 by default).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_ESC="${ROOT//\'/\'\'}"

case "$(uname -s)" in
  Darwin)
    osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "cd '${ROOT_ESC}' && echo '=== Mobile iOS (Simulator) ===' && npm run start:mobile:ios"
end tell
APPLESCRIPT
    echo "Opened Terminal tab for mobile (Expo iOS Simulator)."
    ;;
  Linux)
    if command -v gnome-terminal >/dev/null 2>&1; then
      gnome-terminal --title="Mobile (Expo)" --working-directory="$ROOT" -- bash -lc "echo '=== Mobile (Expo) :8081 ===' && npm run start:mobile; exec bash" &
      echo "Opened gnome-terminal for mobile."
      exit 0
    fi
    if command -v xterm >/dev/null 2>&1; then
      ROOT_Q="$(printf '%q' "$ROOT")"
      xterm -T "Mobile (Expo)" -e bash -lc "cd ${ROOT_Q} && echo '=== Mobile (Expo) :8081 ===' && npm run start:mobile; exec bash" &
      echo "Opened xterm for mobile."
      exit 0
    fi
    echo "Install gnome-terminal or xterm, or from ${ROOT} run: npm run start:mobile"
    exit 1
    ;;
  *)
    echo "From ${ROOT} run: npm run start:mobile"
    exit 1
    ;;
esac
