#!/usr/bin/env bash
# GET /api/orders/:id as ADMIN
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"

if [[ -f "$DIR/.last-order.env" ]]; then
  # shellcheck disable=SC1091
  source "$DIR/.last-order.env"
fi
require_var ORDER_ID

: "${ADMIN_EMAIL:=admin@wrapnroll.com}"
: "${ADMIN_PASSWORD:=pass123}"
AUTH_JSON="$(supabase_token "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ACCESS="$(echo "$AUTH_JSON" | access_token_from_auth_json)"
[[ -n "$ACCESS" ]] || { echo "$AUTH_JSON" >&2; exit 1; }

OUT="$(api_get "$ACCESS" "${API_BASE}/orders/${ORDER_ID}")"
echo "$OUT" | sed '/^HTTP_STATUS:/d' | python3 -m json.tool 2>/dev/null || echo "$OUT" | sed '/^HTTP_STATUS:/d'
echo "--- HTTP $(echo "$OUT" | sed -n 's/^HTTP_STATUS://p') ---"
