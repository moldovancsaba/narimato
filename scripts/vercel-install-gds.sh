#!/usr/bin/env bash
# Clone and build GDS when file:../general-design-system is not present (e.g. Vercel).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GDS_DIR="${GDS_ROOT:-$(dirname "$ROOT")/general-design-system}"
MARKER="$GDS_DIR/packages/gds-core/dist/client.mjs"

if [ -f "$MARKER" ]; then
  echo "GDS already available at $GDS_DIR"
  exit 0
fi

echo "Cloning general-design-system into $GDS_DIR"
git clone --depth 1 https://github.com/sovereignsquad/general-design-system.git "$GDS_DIR"
(cd "$GDS_DIR" && npm ci && npm run build)
echo "GDS build complete"
