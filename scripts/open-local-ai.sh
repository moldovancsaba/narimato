#!/usr/bin/env bash
# Start local intelligence if needed, then open operator + webapp hubs in the browser.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local" 2>/dev/null || true
  set +a
fi

STATUS_PORT="${INTELLIGENCE_STATUS_PORT:-10006}"
WEBAPP_URL="${NARIMATO_WEBAPP_URL:-http://localhost:3000}"
STATUS_URL="http://127.0.0.1:${STATUS_PORT}/api/status"
OPERATOR_URL="http://127.0.0.1:${STATUS_PORT}/"
LABEL="com.narimato.intelligence"
LOG_DIR="$ROOT/logs"

mkdir -p "$LOG_DIR"

is_status_up() {
  curl -sf --max-time 2 "$STATUS_URL" >/dev/null 2>&1
}

wait_for_status() {
  local i
  for i in $(seq 1 30); do
    if is_status_up; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_via_launchd() {
  if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null 2>&1; then
    echo "▶ Starting ${LABEL} (LaunchAgent)…"
    launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    return 0
  fi
  return 1
}

start_via_guardian() {
  if pgrep -f "scripts/guardian.js" >/dev/null 2>&1; then
    echo "ℹ Guardian already running"
    return 0
  fi
  echo "▶ Starting intelligence guardian…"
  nohup node "$ROOT/scripts/guardian.js" >>"$LOG_DIR/desktop-launcher.log" 2>>"$LOG_DIR/desktop-launcher.err.log" &
  disown 2>/dev/null || true
}

webapp_up() {
  curl -sf --max-time 2 "${WEBAPP_URL}/api/intelligence/status" >/dev/null 2>&1
}

echo "🧠 Narimato Local AI"
echo "   Repo: $ROOT"

if ! is_status_up; then
  start_via_launchd || start_via_guardian
  if ! wait_for_status; then
    echo "❌ Status server did not start on port ${STATUS_PORT}"
    echo "   Try: cd \"$ROOT\" && npm run intelligence:guardian"
    echo "   Logs: $LOG_DIR/desktop-launcher.err.log"
    tail -n 15 "$LOG_DIR/desktop-launcher.err.log" 2>/dev/null || true
    exit 1
  fi
fi

echo "✅ Local intelligence is running"
echo "   Operator: $OPERATOR_URL"

open "$OPERATOR_URL"

if webapp_up; then
  echo "   Webapp dev server detected — opening hubs"
  open "${WEBAPP_URL}/local-ai"
  open "${WEBAPP_URL}/cards"
else
  echo "ℹ Webapp not running at ${WEBAPP_URL} (optional: npm run dev)"
fi

exit 0
