#!/usr/bin/env bash
# Copy built @gds/* artifacts from a separate general-design-system checkout into Narimato.
# Narimato and GDS are independent projects; this script only updates vendored deps.
set -euo pipefail

GDS_ROOT="${GDS_ROOT:-${GDS_SSOT_ROOT:-/Users/Shared/Projects/GENERAL_DESIGN_SYSTEM}}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$GDS_ROOT/packages/gds-core/dist" ]]; then
  echo "GDS package dist not found at: $GDS_ROOT"
  echo "Clone and build the general-design-system repo first:"
  echo "  git clone https://github.com/sovereignsquad/general-design-system.git"
  echo "  cd general-design-system && npm run build"
  exit 1
fi

echo "Copying @gds packages from: $GDS_ROOT"
rm -rf "$ROOT/packages/gds-theme/dist" "$ROOT/packages/gds-core/dist"
cp -R "$GDS_ROOT/packages/gds-theme/dist" "$ROOT/packages/gds-theme/"
cp -R "$GDS_ROOT/packages/gds-core/dist" "$ROOT/packages/gds-core/"
cp "$GDS_ROOT/packages/gds-theme/package.json" "$ROOT/packages/gds-theme/package.json"
cp "$GDS_ROOT/packages/gds-core/package.json" "$ROOT/packages/gds-core/package.json"

echo "Done. Commit packages/gds-*/dist if changed, then: npm run build && npm run gds:ci-guard"
