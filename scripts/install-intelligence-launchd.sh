#!/usr/bin/env bash
# Install Narimato local intelligence as a user LaunchAgent (auto-start at login).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.narimato.intelligence"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNNER="$ROOT/scripts/run-intelligence-guardian.sh"
LOG_DIR="$ROOT/logs"
NODE_BIN="$(command -v node)"

mkdir -p "$LOG_DIR"
chmod +x "$RUNNER"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "❌ node not found in PATH"
  exit 1
fi

# Unload previous version if present
if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null; then
  echo "⏹  Unloading existing ${LABEL}…"
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
fi

cat > "$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${RUNNER}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/intelligence-guardian.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/intelligence-guardian.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
</dict>
</plist>
EOF

echo "📄 Wrote ${PLIST_DEST}"
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/${LABEL}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

sleep 2
if curl -sf "http://127.0.0.1:10006/api/status" >/dev/null; then
  echo "✅ Intelligence stack running"
  echo "   Operator console: http://127.0.0.1:10006"
  echo "   Logs: ${LOG_DIR}/intelligence-guardian.log"
else
  echo "⚠️  Installed but status check failed — see ${LOG_DIR}/intelligence-guardian.err.log"
  tail -n 20 "${LOG_DIR}/intelligence-guardian.err.log" 2>/dev/null || true
fi

echo ""
echo "Ollama: ensure it is running (you have existing LaunchAgents for ollama)."
echo "Uninstall: npm run intelligence:uninstall"
