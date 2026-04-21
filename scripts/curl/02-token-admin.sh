#!/usr/bin/env bash
# Print JWT for ADMIN (full order read + staff ops).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib/common.sh"
: "${ADMIN_EMAIL:=admin@wrapnroll.com}"
: "${ADMIN_PASSWORD:=pass123}"
AUTH_JSON="$(supabase_token "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ACCESS="$(echo "$AUTH_JSON" | access_token_from_auth_json)"
if [[ -z "$ACCESS" ]]; then
  echo "$AUTH_JSON" >&2
  exit 1
fi
printf '%s\n' "$ACCESS"
