#!/usr/bin/env bash
# Rewrite doc-alignment issues from scripts/issue-bodies/*.md (reply-quality template).
set -euo pipefail
REPO="moldovancsaba/narimato"
DIR="$(cd "$(dirname "$0")/issue-bodies" && pwd)"

declare -A TITLES
TITLES[11]="{narimato} Program: Documentation and architecture alignment (v7.2)"
TITLES[12]="{narimato} P0: Establish canonical technical spec (v7.2)"
TITLES[13]="{narimato} P0: Fix API reference to match real HTTP routes"
TITLES[14]="{narimato} P0 ADR: Resolve vote-only mode product status"
TITLES[15]="{narimato} P0: Repair WARP.md agent onboarding guide"
TITLES[16]="{narimato} P0: README honesty pass for marketed features"
TITLES[17]="{narimato} P0 ADR: Multi-tenant database — implement or document single-DB MVP"
TITLES[18]="{narimato} P1: Document personal and global ranking algorithms accurately"
TITLES[19]="{narimato} P1: Document deprecated legacy /api/play routes still used by the client"
TITLES[20]="{narimato} P1: Normalize play results mode field contract"
TITLES[21]="{narimato} P1: Align ARCHITECTURE.md database model list with lib/models"
TITLES[22]="{narimato} P2: Remove unused lib/**/* 2.js duplicate modules"
TITLES[23]="{narimato} P2: Align database init scripts with Organization model"
TITLES[24]="{narimato} P2: Implement client vote debounce on play.js"
TITLES[25]="{narimato} P2: API version headers on v1 play start and input routes"

for n in "${!TITLES[@]}"; do
  gh issue edit "$n" --repo "$REPO" --title "${TITLES[$n]}" --body-file "$DIR/$n.md"
  echo "Updated #$n"
done
