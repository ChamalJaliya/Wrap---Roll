#!/usr/bin/env bash
# Create order via client checkout payload with paymentMethod=payhere.
# Prints full response + HTTP status line. Exports ORDER_ID and ORDER_TOTAL for follow-up scripts.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"
: "${CUSTOMER_EMAIL:=customer1@wrapnroll.com}"
: "${CUSTOMER_PASSWORD:=pass123}"

AUTH_JSON="$(supabase_token "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")"
ACCESS="$(echo "$AUTH_JSON" | access_token_from_auth_json)"
[[ -n "$ACCESS" ]] || { echo "$AUTH_JSON" >&2; exit 1; }

MENU_JSON="$(curl -sS "${API_BASE}/menu")"
PAYLOAD="$(MENU_JSON="$MENU_JSON" python3 - <<'PY'
import json, os
menu = json.loads(os.environ["MENU_JSON"])
items = menu.get("items") or []
# skip sold_out for a cleaner default; fall back to first item
pick = next((x for x in items if x.get("availability") != "sold_out"), items[0] if items else None)
if not pick:
    raise SystemExit("No menu items")
item_id = pick["itemId"]
name = pick["name"]
price = float(pick["basePrice"])
body = {
    "fulfillmentType": "TAKEAWAY",
    "customerName": "Curl PayHere Test",
    "customerPhone": "0774999001",
    "paymentMethod": "payhere",
    "items": [{
        "itemId": item_id,
        "name": name,
        "quantity": 1,
        "basePrice": price,
        "modifiers": [],
        "totalPrice": price,
    }],
}
print(json.dumps(body))
PY
)"

OUT="$(api_post_json "$ACCESS" "${API_BASE}/orders" "$PAYLOAD")"
BODY="$(echo "$OUT" | sed '/^HTTP_STATUS:/d')"
STATUS="$(echo "$OUT" | sed -n 's/^HTTP_STATUS://p')"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo "--- HTTP $STATUS ---"

if [[ "$STATUS" != "201" ]]; then
  echo "Order create failed; fix API error before webhook step (see README troubleshooting)." >&2
  exit 1
fi

ORDER_ID="$(echo "$BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)"
TOTAL="$(echo "$BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("total",""))' 2>/dev/null || true)"
if [[ -n "$ORDER_ID" ]]; then
  echo "export ORDER_ID=$ORDER_ID" > "${DIR}/.last-order.env"
  echo "export ORDER_TOTAL=$TOTAL" >> "${DIR}/.last-order.env"
  echo "# source scripts/curl/.last-order.env for webhook step" >&2
fi
