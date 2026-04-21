#!/usr/bin/env bash
# Public menu list (no auth). Pretty-print first 3 items.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"
curl -sS "${API_BASE}/menu" | python3 -c '
import json,sys
d=json.load(sys.stdin)
items=d.get("items",[])
print(json.dumps(items[:3], indent=2))
print("... total items:", len(items))
'
