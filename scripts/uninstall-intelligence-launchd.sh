#!/usr/bin/env bash
set -euo pipefail
LABEL="com.narimato.intelligence"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null; then
  launchctl bootout "gui/$(id -u)/${LABEL}" || true
  echo "⏹  Stopped ${LABEL}"
fi

if [[ -f "$PLIST" ]]; then
  rm "$PLIST"
  echo "🗑  Removed ${PLIST}"
fi

echo "Done."
