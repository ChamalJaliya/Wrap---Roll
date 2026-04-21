#!/usr/bin/env bash
# Expo iOS run with common macOS Homebrew paths (fixes missing pod/brew in minimal shells).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec npx expo run:ios "$@"
