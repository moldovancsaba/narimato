#!/usr/bin/env bash
# Build only Narimato's file-linked GDS packages (skip playground/reference apps).
set -euo pipefail

GDS_DIR="${1:-${GDS_DIR:-${GDS_ROOT:-}}}"

if [ -z "$GDS_DIR" ]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  GDS_DIR="$(dirname "$ROOT")/general-design-system"
fi

cd "$GDS_DIR"
npm ci
npm run build --workspace=@doneisbetter/gds-theme
npm run build --workspace=@doneisbetter/gds-core
npm run build --workspace=@doneisbetter/gds-admin
