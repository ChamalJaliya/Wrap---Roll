#!/usr/bin/env bash
# Linux: ensure Redis, then try to open one terminal window per service (gnome-terminal or xterm).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_Q="$(printf '%q' "$ROOT")"

cd "$ROOT"
npm run ensure:redis:local

launch_gnome() {
  local title="$1" npm_script="$2"
  gnome-terminal --title="$title" --working-directory="$ROOT" -- bash -lc "echo '=== ${title} ===' && npm run ${npm_script}; exec bash" &
}

launch_xterm() {
  local title="$1" npm_script="$2"
  xterm -T "$title" -e bash -lc "cd ${ROOT_Q} && echo '=== ${title} ===' && npm run ${npm_script}; exec bash" &
}

if command -v gnome-terminal >/dev/null 2>&1; then
  launch_gnome "API :4000" "start:api"
  launch_gnome "Client :3000" "start:client"
  launch_gnome "Admin :3001" "start:admin"
  launch_gnome "Cashier :3002" "start:cashier"
  launch_gnome "Kitchen :3003" "start:kitchen"
  launch_gnome "Delivery :3004" "start:delivery"
  launch_gnome "Mobile (Expo)" "start:mobile"
  echo "Redis ensured; opened 7 gnome-terminal windows (API, 5 web, mobile Expo)."
  exit 0
fi

if command -v xterm >/dev/null 2>&1; then
  launch_xterm "API :4000" "start:api"
  launch_xterm "Client :3000" "start:client"
  launch_xterm "Admin :3001" "start:admin"
  launch_xterm "Cashier :3002" "start:cashier"
  launch_xterm "Kitchen :3003" "start:kitchen"
  launch_xterm "Delivery :3004" "start:delivery"
  launch_xterm "Mobile (Expo)" "start:mobile"
  echo "Redis ensured; opened 7 xterm windows (API, 5 web, mobile Expo)."
  exit 0
fi

echo "Install gnome-terminal or xterm, or run these in separate terminals from ${ROOT}:"
echo "  npm run ensure:redis:local"
echo "  npm run start:api"
echo "  npm run start:client"
echo "  npm run start:admin"
echo "  npm run start:cashier"
echo "  npm run start:kitchen"
echo "  npm run start:delivery"
echo "Mobile (optional): npm run start:mobile"
exit 1
