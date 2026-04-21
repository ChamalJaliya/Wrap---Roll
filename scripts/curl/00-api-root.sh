#!/usr/bin/env bash
# smoke: GET /api (Nest global prefix)
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
curl -sS "$API_BASE" | python3 -m json.tool 2>/dev/null || curl -sS "$API_BASE"
echo
