#!/usr/bin/env bash
# POST /api/payment/webhook (public) — simulate PayHere success (status_code=2).
# payhere_amount must match order.total for amount check; signature uses the SAME string.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"

if [[ -f "$DIR/.last-order.env" ]]; then
  # shellcheck disable=SC1091
  source "$DIR/.last-order.env"
fi
require_var ORDER_ID
require_var PAYHERE_MERCHANT_ID
require_var PAYHERE_MERCHANT_SECRET

# Amount string: use API total verbatim (e.g. 828) — see PaymentService.processWebhook
AMOUNT_STR="${1:-${ORDER_TOTAL:-}}"
[[ -n "$AMOUNT_STR" ]] || { echo "Usage: $0 [payhere_amount_string] or run 04 first" >&2; exit 1; }

WEBHOOK_PAYMENT_ID="${WEBHOOK_PAYMENT_ID:-PH_CURL_$(date +%s)}"
SIG="$(python3 "$DIR/lib/payhere_webhook_sig.py" --order-id "$ORDER_ID" --amount "$AMOUNT_STR")"

PAYLOAD="$(ORDER_ID="$ORDER_ID" AMOUNT_STR="$AMOUNT_STR" PAYMENT_ID="$WEBHOOK_PAYMENT_ID" SIG="$SIG" MERCHANT_ID="$PAYHERE_MERCHANT_ID" python3 - <<'PY'
import json, os
print(json.dumps({
    "merchant_id": os.environ["MERCHANT_ID"],
    "order_id": os.environ["ORDER_ID"],
    "payment_id": os.environ["PAYMENT_ID"],
    "payhere_amount": os.environ["AMOUNT_STR"],
    "payhere_currency": "LKR",
    "status_code": "2",
    "md5sig": os.environ["SIG"],
}))
PY
)"

echo "POST webhook (payment_id=$WEBHOOK_PAYMENT_ID)..."
OUT="$(curl -sS -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_BASE}/payment/webhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")"
echo "$OUT" | sed '/^HTTP_STATUS:/d' | python3 -m json.tool 2>/dev/null || echo "$OUT" | sed '/^HTTP_STATUS:/d'
echo "--- HTTP $(echo "$OUT" | sed -n 's/^HTTP_STATUS://p') ---"
