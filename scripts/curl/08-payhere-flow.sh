#!/usr/bin/env bash
# Full sequence: create payhere order → webhook success → verify as admin.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "== 04 create order =="
bash "$DIR/04-order-create-payhere.sh"
echo
echo "== 06 webhook =="
bash "$DIR/06-payhere-webhook-success.sh"
echo
echo "== 07 get order =="
bash "$DIR/07-order-get-admin.sh"
