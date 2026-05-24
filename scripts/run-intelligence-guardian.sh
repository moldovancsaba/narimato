#!/usr/bin/env bash
# Launchd-friendly entrypoint: load env, ensure PATH, run guardian.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
cd "$ROOT"
exec node "$ROOT/scripts/guardian.js"
