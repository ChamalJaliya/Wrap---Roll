#!/usr/bin/env bash
# POST /api/payment/hash — checkout form md5 (amount as number; server uses .toFixed(2)).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"
: "${CUSTOMER_EMAIL:=customer1@wrapnroll.com}"
: "${CUSTOMER_PASSWORD:=pass123}"

if [[ -f "$DIR/.last-order.env" ]]; then
  # shellcheck disable=SC1091
  source "$DIR/.last-order.env"
fi
require_var ORDER_ID
AMOUNT="${1:-${ORDER_TOTAL:-}}"
[[ -n "$AMOUNT" ]] || { echo "Usage: $0 [amount] or set ORDER_ID/ORDER_TOTAL via 04 script" >&2; exit 1; }

AUTH_JSON="$(supabase_token "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")"
ACCESS="$(echo "$AUTH_JSON" | access_token_from_auth_json)"
[[ -n "$ACCESS" ]] || { echo "$AUTH_JSON" >&2; exit 1; }

BODY="$(python3 -c "import json; print(json.dumps({\"orderId\":\"$ORDER_ID\",\"amount\":float(\"$AMOUNT\"),\"currency\":\"LKR\"}))")"
curl -sS -X POST "${API_BASE}/payment/hash" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool
