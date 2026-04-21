#!/usr/bin/env bash
# Print JWT access_token for seeded CUSTOMER (client_web checkout).
set -euo pipefail
# shellcheck source=lib/common.sh
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"
: "${CUSTOMER_EMAIL:=customer1@wrapnroll.com}"
: "${CUSTOMER_PASSWORD:=pass123}"
AUTH_JSON="$(supabase_token "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")"
ACCESS="$(echo "$AUTH_JSON" | access_token_from_auth_json)"
if [[ -z "$ACCESS" ]]; then
  echo "$AUTH_JSON" >&2
  exit 1
fi
printf '%s\n' "$ACCESS"
