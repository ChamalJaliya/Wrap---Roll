# HTTP / curl collection (local API)

Organized shell scripts for smoke tests and PayHere sandbox-style flows. All paths assume the Nest API global prefix `/api` (default `API_BASE=http://localhost:4000/api`).

## Setup

1. Copy env template and fill Supabase. PayHere sandbox `PAYHERE_*` in `env.example` already match `services/api/.env`:

   ```bash
   cp scripts/curl/env.example scripts/curl/.env
   ```

2. Optionally pull PayHere vars from the API env in the same shell:

   ```bash
   set -a && source services/api/.env && set +a
   # then run scripts; or paste PAYHERE_* into scripts/curl/.env
   ```

## Scripts (run from repo root)

| Script | Purpose |
|--------|---------|
| `scripts/curl/00-api-root.sh` | `GET /api` smoke |
| `scripts/curl/01-token-customer.sh` | Customer JWT (stdout) |
| `scripts/curl/02-token-admin.sh` | Admin JWT (stdout) |
| `scripts/curl/03-menu.sh` | `GET /api/menu` sample |
| `scripts/curl/04-order-create-payhere.sh` | `POST /api/orders` (client checkout + payhere); writes `scripts/curl/.last-order.env` |
| `scripts/curl/05-payment-hash.sh` | `POST /api/payment/hash` for hosted checkout form |
| `scripts/curl/06-payhere-webhook-success.sh` | `POST /api/payment/webhook` (simulate success); uses `payhere_webhook_sig.py` |
| `scripts/curl/07-order-get-admin.sh` | `GET /api/orders/:id` as admin |
| `scripts/curl/08-payhere-flow.sh` | Runs 04 → 06 → 07 |

Examples:

```bash
bash scripts/curl/04-order-create-payhere.sh
bash scripts/curl/06-payhere-webhook-success.sh
bash scripts/curl/07-order-get-admin.sh
```

Or one shot:

```bash
bash scripts/curl/08-payhere-flow.sh
```

## Troubleshooting

- **`Ordering is closed for this service window`** — The API enforces business hours + cutoff from `BusinessSettings`. Widen hours / lower `orderCutoffBeforeCloseMinutes` in admin settings, re-seed, or run the scripts during an open window.

## Notes

- Webhook `md5sig` is built like `PaymentService.processWebhook`:  
  `md5(merchant_id + order_id + payhere_amount + CURRENCY_UPPER + status_code + md5(secret))`.
- `payhere_amount` must be the **exact** string used in the JSON body and must match `order.total` numerically (see API validation).
- `scripts/curl/lib/payhere_webhook_sig.py` uses the same base64-numeric-secret resolution as the API.
