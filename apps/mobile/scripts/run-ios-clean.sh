#!/usr/bin/env bash
# Clear Expo/Metro caches and Xcode build artifacts, then run iOS with a clean native build.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
watchman watch-del-all 2>/dev/null || true
rm -rf .expo node_modules/.cache ios/build
exec npx expo run:ios --no-build-cache "$@"
