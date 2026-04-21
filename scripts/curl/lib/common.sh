#!/usr/bin/env bash
# Shared helpers for scripts/curl/*.sh
# shellcheck source=/dev/null

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

: "${API_BASE:=http://localhost:4000/api}"
: "${SUPABASE_URL:?Set SUPABASE_URL in scripts/curl/.env}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY in scripts/curl/.env}"

require_var() {
  local name="$1"
  [[ -n "${!name:-}" ]] || { echo "Missing required env: $name" >&2; exit 1; }
}

supabase_token() {
  local email="$1" password="$2"
  curl -sS -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}"
}

access_token_from_auth_json() {
  python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))'
}

api_post_json() {
  local bearer="$1" url="$2" body="$3"
  curl -sS -w "\nHTTP_STATUS:%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer ${bearer}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

api_get() {
  local bearer="$1" url="$2"
  curl -sS -w "\nHTTP_STATUS:%{http_code}" -H "Authorization: Bearer ${bearer}" "$url"
}
