#!/usr/bin/env bash
# Install a double-clickable launcher on the macOS Desktop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="${HOME}/Desktop"
APP_NAME="Open Narimato Local AI.command"
TARGET="${DESKTOP}/${APP_NAME}"

cat >"$TARGET" <<EOF
#!/bin/bash
cd "${ROOT}" || exit 1
exec bash "${ROOT}/scripts/open-local-ai.sh"
EOF

chmod +x "$TARGET"
chmod +x "${ROOT}/scripts/open-local-ai.sh"

echo "✅ Desktop launcher installed:"
echo "   ${TARGET}"
echo ""
echo "Double-click it to start (if needed) and open the operator console."
echo "To remove: delete the file from your Desktop."
