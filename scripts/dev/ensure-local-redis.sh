#!/usr/bin/env bash
set -euo pipefail

REDIS_URL_VALUE="${REDIS_URL:-redis://127.0.0.1:6379}"
REDIS_BIN="${HOME}/.local/redis/bin/redis-server"
REDIS_CLI_BIN="${HOME}/.local/redis/bin/redis-cli"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"

# Skip local bootstrap when using a non-local Redis host
# (e.g. Docker compose uses redis://redis:6379).
if [[ "${REDIS_URL_VALUE}" != *"127.0.0.1"* && "${REDIS_URL_VALUE}" != *"localhost"* ]]; then
  echo "[redis] using external REDIS_URL (${REDIS_URL_VALUE}), skipping local bootstrap."
  exit 0
fi

if lsof -ti :"${REDIS_PORT}" >/dev/null 2>&1; then
  echo "[redis] already running on port ${REDIS_PORT}; preserving existing instance."
  exit 0
fi

if [[ ! -x "${REDIS_BIN}" ]]; then
  echo "[redis] local redis-server not found at ${REDIS_BIN}"
  echo "[redis] install once (non-docker):"
  echo "        mkdir -p \"\$HOME/.local/src\" \"\$HOME/.local/redis\""
  echo "        cd \"\$HOME/.local/src\""
  echo "        curl -L \"https://download.redis.io/redis-stable.tar.gz\" -o redis-stable.tar.gz"
  echo "        tar -xzf redis-stable.tar.gz"
  echo "        cd redis-stable"
  echo "        make -j4 && make PREFIX=\"\$HOME/.local/redis\" install"
  exit 1
fi

mkdir -p "${HOME}/.local/redis/run"
LOG_FILE="${HOME}/.local/redis/run/redis.log"
PID_FILE="${HOME}/.local/redis/run/redis.pid"

"${REDIS_BIN}" \
  --bind "${REDIS_HOST}" \
  --port "${REDIS_PORT}" \
  --daemonize yes \
  --logfile "${LOG_FILE}" \
  --pidfile "${PID_FILE}" \
  --dir "${HOME}/.local/redis/run"

if [[ -x "${REDIS_CLI_BIN}" ]]; then
  "${REDIS_CLI_BIN}" -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping >/dev/null
fi

echo "[redis] started local Redis on ${REDIS_HOST}:${REDIS_PORT} (preserved after API exits)."
