#!/usr/bin/env bash
# Creates doc-alignment GitHub issues and adds them to project #33.
# Idempotent: skips if issue title already exists.
set -euo pipefail
REPO="moldovancsaba/narimato"
MILESTONE="Doc & Architecture Alignment"
PROJECT_NUM=33
PROJECT_OWNER="moldovancsaba"
PROJECT_ID="PVT_kwHOACGtF84BXhY8"
STATUS_FIELD="PVTSSF_lAHOACGtF84BXhY8zhStr_0"

# Status option IDs
STATUS_BACKLOG="1a174b4f"
STATUS_TODO="f75ad846"
STATUS_ROADMAP="92255da5"

issue_exists() {
  local title="$1"
  gh issue list --repo "$REPO" --search "in:title \"$title\"" --state all --json title --jq ".[] | select(.title == \"$title\") | .title" | grep -q .
}

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  local status="$4"
  if issue_exists "$title"; then
    echo "SKIP (exists): $title"
    gh issue list --repo "$REPO" --search "in:title \"$title\"" --state all --json url --jq '.[0].url'
    return
  fi
  local url
  url=$(gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$labels" --milestone "$MILESTONE")
  echo "CREATED: $title -> $url"
  add_to_project "$url" "$status"
  echo "$url"
}

add_to_project() {
  local url="$1"
  local status="$2"
  local item_id
  item_id=$(gh project item-add "$PROJECT_NUM" --owner "$PROJECT_OWNER" --url "$url" --format json --jq '.id')
  gh project item-edit --project-id "$PROJECT_ID" --id "$item_id" \
    --field-id "$STATUS_FIELD" --single-select-option-id "$status" >/dev/null
}

# --- Epic ---
create_issue \
  "[Epic] Doc & architecture alignment program" \
  "## Summary
Parent program to fix documentation vs code drift identified in the May 2026 audit.

**Plan:** [docs/DOC_ALIGNMENT_IMPLEMENTATION_PLAN.md](https://github.com/moldovancsaba/narimato/blob/main/docs/DOC_ALIGNMENT_IMPLEMENTATION_PLAN.md)

## Phases
- **Phase 0** — Documentation truth baseline (P0)
- **Phase 1** — Architecture honesty (P1)
- **Phase 2** — Code hygiene (P2)

## Success criteria
- One canonical spec; no false README claims; ADRs for vote-only and multi-tenant; project board reflects all deliverables.

## Child issues
Link sub-issues via GitHub sub-issue UI or checklist below as they are created." \
  "doc-alignment,enhancement" \
  "$STATUS_BACKLOG"

# --- Phase 0 ---
create_issue \
  "[P0] Establish canonical technical spec (v7.2)" \
  "## Deliverable 0.1
Update \`narimato_unified_documentation.md\` to **7.1.0+** (stack, API paths, fieldNames mapping).

## Tasks
- [ ] Bump version/date; align Next.js to package.json (15.5.9)
- [ ] Move aspirational content from ARCHITECTURE.md to \`docs/FUTURE.md\` (theming, TS/App Router, Session/GlobalRanking models)
- [ ] Add pointer in README/WARP: \"Canonical spec → unified doc\"
- [ ] Cross-check against \`lib/models/*\` and \`pages/api/*\`

## Acceptance
Contributor reads unified doc + README without contradictions on stack, API base paths, UUID field mapping.

Part of doc-alignment epic." \
  "doc-alignment,phase-0,documentation" \
  "$STATUS_TODO"

create_issue \
  "[P0] Fix API_REFERENCE — document real /api/cards routes" \
  "## Deliverable 0.2

## Problem
Docs describe \`/api/v1/cards\` with \`body.textContent\` and \`operation: SAVE\`; code uses \`/api/cards\` with \`title\`, \`description\`, \`parentTag\`.

## Tasks
- [ ] Remove or mark **Historical** the \`cardName\`/\`sessionId\`/\`playUuid\` play-start section
- [ ] Document: \`GET/POST /api/cards\`, \`GET/PUT/DELETE /api/cards/[uuid]\`, \`GET /api/cards/rankings\`
- [ ] Match request/response to \`pages/api/cards.js\` and Card model
- [ ] Note internal-only utility sections stay non-HTTP

## Acceptance
Every route under \`pages/api/\` is documented or listed as deprecated.

Part of doc-alignment epic." \
  "doc-alignment,phase-0,documentation" \
  "$STATUS_TODO"

create_issue \
  "[ADR] Vote-only mode — keep, restore page, or fully remove?" \
  "## Deliverable 0.3 (decision)

## Conflict
- RELEASE_NOTES + \`/vote-only\` page: **removed**
- README + \`VoteOnlyService\` + play UI + \`/api/v1/play/vote-only/start\`: **active**

## Options
**A.** Keep vote-only — revert 410 page, fix RELEASE_NOTES, document as supported mode  
**B.** Remove vote-only — delete engine, API, UI button; update README  
**C.** Deprecate — keep API, hide UI, document sunset date

## Tasks
- [ ] Record decision in \`docs/adr/NNN-vote-only.md\`
- [ ] Apply across README, RELEASE_NOTES, pages, PlayDispatcher

## Acceptance
No contradictory \"removed\" vs \"feature\" messaging.

Labels: decision-needed" \
  "doc-alignment,phase-0,decision-needed,documentation" \
  "$STATUS_BACKLOG"

create_issue \
  "[P0] Repair WARP.md — UUID aliases, stack, remove fiction" \
  "## Deliverable 0.4

## Fixes
- [ ] Next.js **15.5.9** (not 15.5.3)
- [ ] Replace \`UUID_FIELDS\` import example with \`fieldNames\` from \`lib/constants/fieldNames.js\`
- [ ] Document mapping: \`OrganizationUUID → organizationId\`, etc. (do NOT say \"never use uuid\")
- [ ] Remove \`buildOrgMongoUri\` / per-org DB claims OR gate behind ADR #1.1
- [ ] Remove @react-spring / @use-gesture from stack unless added to package.json
- [ ] Rate limits: document actual per-route caps (60/120)

Part of doc-alignment epic." \
  "doc-alignment,phase-0,documentation" \
  "$STATUS_TODO"

create_issue \
  "[P0] README honesty pass — remove false feature claims" \
  "## Deliverable 0.5

## Remove or qualify
- [ ] \"Full dark mode\" — not implemented (no data-theme / tailwind)
- [ ] \"Optimistic locking\" — not on Play model
- [ ] Organization theming — not in Organization schema/UI
- [ ] \"Binary search\" as primary — clarify VoteOnlyService on v1 path

## Add
- [ ] **7 play modes** including \`onboarding\`
- [ ] Cards API at \`/api/cards\` (not v1)
- [ ] Link to canonical spec

Part of doc-alignment epic." \
  "doc-alignment,phase-0,documentation" \
  "$STATUS_TODO"

# --- Phase 1 ---
create_issue \
  "[ADR] Multi-tenant database — implement or document single-DB MVP" \
  "## Deliverable 1.1 (decision)

## Problem
Docs/scripts claim master + per-org DBs and \`buildOrgMongoUri\`; runtime uses single \`connectDB()\`.

## Options
**A.** Implement org-scoped connections in \`lib/db.js\` + API middleware  
**B.** Document single-database MVP; align scripts and Organization model; remove \`databaseName\` from setup docs

## Tasks
- [ ] ADR in \`docs/adr/\`
- [ ] Update WARP, unified doc, scripts consistently

Part of doc-alignment epic." \
  "doc-alignment,phase-1,decision-needed" \
  "$STATUS_BACKLOG"

create_issue \
  "[P1] Document ranking algorithms — VoteOnlyService vs binary search" \
  "## Deliverable 1.2

## Reality
- v1 vote modes → \`VoteOnlyService\` (challenger/opponent, not binary search)
- \`BinarySearchEngine\` exists in \`DecisionTreeService\` but not on unified API path
- Legacy \`/api/play/vote\` → \`DecisionTreeEngine\`

## Tasks
- [ ] Update README, unified doc, play.js comments
- [ ] Either wire binary search into vote-only OR mark as legacy/orphan in \`docs/FUTURE.md\`

Part of doc-alignment epic." \
  "doc-alignment,phase-1,documentation" \
  "$STATUS_BACKLOG"

create_issue \
  "[P1] Document legacy /api/play/* routes (deprecated but active)" \
  "## Deliverable 1.3

## Routes still used by pages/play.js
\`/api/play/start\`, \`swipe\`, \`vote\`, \`current\`, \`hierarchical-status\`, etc.

## Tasks
- [ ] Add \`docs/DEPRECATED_API.md\` or section in API_REFERENCE
- [ ] Migration table: classic flow → v1 unified
- [ ] Optional follow-up issue: remove classic branch from play.js

Part of doc-alignment epic." \
  "doc-alignment,phase-1,documentation" \
  "$STATUS_BACKLOG"

create_issue \
  "[P1] Normalize play results mode strings and document contract" \
  "## Deliverable 1.4

## Problem
Engines return mixed: \`swipe-only\`, \`swipe_only\`, \`vote_only\`, etc.

## Tasks
- [ ] Pick canonical format (recommend \`snake_case\` matching start API)
- [ ] Normalize in engines OR document per-engine values
- [ ] Update API_REFERENCE results examples

Part of doc-alignment epic." \
  "doc-alignment,phase-1,enhancement" \
  "$STATUS_ROADMAP"

create_issue \
  "[P1] Align ARCHITECTURE.md model inventory with lib/models/" \
  "## Deliverable 1.5

## Remove references to non-existent models
Session, GlobalRanking, SystemVersion, FontPreset, BackgroundPreset, Deck

## Document actual models
Play, Card, Organization, mode-specific plays, User, PagePassword

## Note
ELO lives on \`Card.globalScore\`, not GlobalRanking collection.

Part of doc-alignment epic." \
  "doc-alignment,phase-1,documentation" \
  "$STATUS_BACKLOG"

# --- Phase 2 ---
create_issue \
  "[P2] Remove 35 duplicate * 2.js files under lib/" \
  "## Deliverable 2.1

## Problem
macOS duplicate copies; some drift from canonical (e.g. SwipeOnlyPlay 2.js drops onboardingIndex).

## Tasks
- [ ] \`diff\` each \`* 2.js\` vs canonical; merge any intentional changes first
- [ ] Delete all unreferenced \`* 2.js\`
- [ ] Verify \`npm run build\` and smoke play flow

Part of doc-alignment epic." \
  "doc-alignment,phase-2,javascript" \
  "$STATUS_ROADMAP"

create_issue \
  "[P2] Align DB init scripts with lib/models/Organization.js" \
  "## Deliverable 2.2

## Problem
\`setup-databases.js\` uses displayName/databaseName; runtime model uses name only.

## Tasks
- [ ] Single Organization schema source (import from lib/models)
- [ ] Update init/setup scripts; document env for single-DB MVP if ADR chooses B

Part of doc-alignment epic." \
  "doc-alignment,phase-2" \
  "$STATUS_ROADMAP"

create_issue \
  "[P2] Add client-side vote debounce (100ms) on play.js" \
  "## Deliverable 2.3

## Problem
WARP claims 100ms client debounce; only server 2s dedupe in VoteOnlyService exists.

## Tasks
- [ ] Debounce vote button handler in pages/play.js
- [ ] Document in WARP + API_REFERENCE vote integrity section

Part of doc-alignment epic." \
  "doc-alignment,phase-2,enhancement" \
  "$STATUS_ROADMAP"

create_issue \
  "[P2] API versioning parity on v1 play start + input" \
  "## Deliverable 2.4

## Problem
\`next\`/\`results\` use \`withApiVersion\`; \`start\`/\`input\` may not emit version headers consistently.

## Tasks
- [ ] Apply \`withApiVersion\` to start + input OR document exception
- [ ] Update API_REFERENCE version negotiation section

Part of doc-alignment epic." \
  "doc-alignment,phase-2,enhancement" \
  "$STATUS_ROADMAP"

echo "Done."
