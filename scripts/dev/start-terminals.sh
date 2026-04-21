#!/usr/bin/env bash
# Open one terminal session per dev service (API + 5 web apps + mobile; Redis ensured first). Metro-only mobile: npm run dev:terminals:mobile
# macOS: Terminal.app (one tab per service). Linux: separate gnome-terminal windows when available.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)" in
  Darwin)
    exec bash "$DIR/start-terminals-macos.sh"
    ;;
  Linux)
    exec bash "$DIR/start-terminals-linux.sh"
    ;;
  *)
    echo "Unsupported OS: $(uname -s)"
    echo "Open terminals in your repo root and run:"
    echo "  npm run ensure:redis:local"
    echo "  npm run start:api"
    echo "  npm run start:client"
    echo "  npm run start:admin"
    echo "  npm run start:cashier"
    echo "  npm run start:kitchen"
    echo "  npm run start:delivery"
    echo "Mobile (optional): npm run start:mobile"
    exit 1
    ;;
esac
