#!/usr/bin/env bash
# Creates GDS optional-improvement GitHub issues and adds them to project #33.
# Idempotent: skips if issue title already exists.
set -euo pipefail
REPO="moldovancsaba/narimato"
MILESTONE="GDS optional improvements"
PROJECT_NUM=33
PROJECT_OWNER="moldovancsaba"
PROJECT_ID="PVT_kwHOACGtF84BXhY8"
STATUS_FIELD="PVTSSF_lAHOACGtF84BXhY8zhStr_0"

STATUS_ROADMAP="92255da5"
STATUS_BACKLOG="1a174b4f"
STATUS_TODO="f75ad846"

issue_exists() {
  local title="$1"
  gh issue list --repo "$REPO" --search "in:title \"$title\"" --state all --json title --jq ".[] | select(.title == \"$title\") | .title" | grep -q .
}

get_issue_url() {
  local title="$1"
  gh issue list --repo "$REPO" --search "in:title \"$title\"" --state all --json url,title --jq ".[] | select(.title == \"$title\") | .url" | head -1
}

add_to_project() {
  local url="$1"
  local status="$2"
  local item_id
  item_id=$(gh project item-add "$PROJECT_NUM" --owner "$PROJECT_OWNER" --url "$url" --format json --jq '.id')
  gh project item-edit --project-id "$PROJECT_ID" --id "$item_id" \
    --field-id "$STATUS_FIELD" --single-select-option-id "$status" >/dev/null
}

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  local status="$4"
  if issue_exists "$title"; then
    echo "SKIP (exists): $title"
    local url
    url=$(get_issue_url "$title")
    add_to_project "$url" "$status" 2>/dev/null || true
    echo "$url"
    return
  fi
  local url
  url=$(gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$labels" --milestone "$MILESTONE")
  echo "CREATED: $title -> $url"
  add_to_project "$url" "$status"
  echo "$url"
}

ensure_milestone() {
  if gh api "repos/$REPO/milestones" --jq ".[] | select(.title==\"$MILESTONE\") | .number" | grep -q .; then
    echo "Milestone exists: $MILESTONE"
    return
  fi
  gh api "repos/$REPO/milestones" -f title="$MILESTONE" -f description="Optional GDS polish: SemanticButton, metric cards, shell dark mode. Plan: docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md" >/dev/null
  echo "Created milestone: $MILESTONE"
}

ensure_labels() {
  for label in "gds-polish" "area: ui" "phase-gds"; do
  gh label create "$label" --repo "$REPO" --force 2>/dev/null || true
  done
}

ensure_milestone
ensure_labels

PROGRAM_TITLE="{narimato} Program: GDS optional UI improvements"
PH1_TITLE="{narimato} GDS-1: SemanticButton on operator and public flows"
PH2_TITLE="{narimato} GDS-2: Shared NarimatoMetricCard on setup dashboard"
PH3_TITLE="{narimato} GDS-3: Light and dark mode on shell pages"

create_issue \
  "$PROGRAM_TITLE" \
  "## Objective
Track optional UI polish so Narimato uses the external [General Design System](https://github.com/sovereignsquad/general-design-system) consistently. GDS and Narimato are **separate projects**; this program only changes the Narimato repo.

## Plan
[docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md](https://github.com/moldovancsaba/narimato/blob/main/docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md)

## Child deliverables
| Order | Issue | Effort |
|-------|-------|--------|
| 1 | GDS-1 SemanticButton | ~0.5–1 day |
| 2 | GDS-2 Metric card | ~0.5 day |
| 3 | GDS-3 Shell dark mode | ~1–2 days |

## Goal
Consistent action buttons, reusable dashboard stat cards, and light/dark toggle on shell pages (not immersive play).

## Out of scope
- Merging GDS into Narimato
- Per-organisation theming
- Full-app i18n
- Rewriting every button in one PR

## Acceptance
- [ ] All three child issues closed
- [ ] \`docs/GDS_ADOPTION.md\` pattern inventory updated
- [ ] \`npm run gds:ci-guard\` and \`npm run build\` pass after each phase

## Dependencies
- Vendored \`packages/gds-*\` in sync (run \`npm run gds:sync\` when GDS releases new builds)" \
  "enhancement,gds-polish,area: ui,priority: P2" \
  "$STATUS_ROADMAP"

create_issue \
  "$PH1_TITLE" \
  "## Parent
Sub-issue of [#47 — GDS optional UI program](https://github.com/moldovancsaba/narimato/issues/47)

## Objective
Use GDS \`SemanticButton\` and \`GdsVocabulary\` for primary actions on local setup and the public landing flow so labels and icons stay consistent.

## Scope
- Operator: \`OperatorDashboard\`, \`OperatorSurveyPanel\`, \`OperatorOrganizationsPanel\`, key actions in \`LocalOperatorConsole\`
- Public: \`pages/index.js\` (survey password submit)
- Keep \`ConfirmDialog\` on \`confirmAction\` / \`cancelAction\` (already aligned)

## Tasks
- [ ] Optional thin wrapper \`components/NarimatoSemanticButton.js\`
- [ ] Map CTAs to valid \`SemanticAction\` keys (\`play\`, \`start\`, \`save\`, \`delete\`, \`send\`, etc.)
- [ ] Run \`npm run gds:ci-guard\` and \`npm run build:operator\`

## Acceptance
- [ ] Primary CTAs on listed screens use \`SemanticButton\` or documented exception
- [ ] No legacy \`confirmLabel\` on \`ConfirmDialog\`
- [ ] CI guard passes

## Plan section
Phase 1 in [docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md](https://github.com/moldovancsaba/narimato/blob/main/docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md)" \
  "enhancement,gds-polish,area: ui,priority: P2,phase-gds" \
  "$STATUS_TODO"

create_issue \
  "$PH2_TITLE" \
  "## Parent
Sub-issue of [#47 — GDS optional UI program](https://github.com/moldovancsaba/narimato/issues/47)

## Objective
Extract a reusable \`NarimatoMetricCard\` so setup dashboard stats match the GDS metric-card pattern and future stat screens do not copy-paste layout.

## Scope
- New \`components/NarimatoMetricCard.js\`
- Refactor \`OperatorDashboard.js\` stat tiles
- Update \`docs/GDS_ADOPTION.md\` pattern row (metric card → Done)

## Out of scope
Play results, rankings, charts

## Acceptance
- [ ] Dashboard visual parity with today
- [ ] Single component reused for all dashboard metrics
- [ ] GDS adoption doc updated

## Plan section
Phase 2 in [docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md](https://github.com/moldovancsaba/narimato/blob/main/docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md)" \
  "enhancement,gds-polish,area: ui,priority: P2,phase-gds" \
  "$STATUS_BACKLOG"

create_issue \
  "$PH3_TITLE" \
  "## Parent
Sub-issue of [#47 — GDS optional UI program](https://github.com/moldovancsaba/narimato/issues/47)

## Objective
Enable light/dark mode on **shell** pages (public site + local setup) using GDS \`ThemeToggle\`, with documented exceptions for immersive play.

## Scope
- \`ThemeToggle\` on \`PublicShell\`
- \`ColorSchemeScript\` in \`_document.js\` or \`_app.js\` to avoid flash
- Verify operator shell toggle; audit admin/auth shells
- Spot-check play picker; **exception** for in-game \`/play\` CSS
- Update \`docs/FUTURE.md\` and \`docs/GDS_ADOPTION.md\` exceptions

## QA checklist
- [ ] Home, privacy, terms, cookies — readable in both modes
- [ ] Operator Home + Share survey — readable in both modes
- [ ] Landing password form readable in dark mode
- [ ] Immersive play still works (no regression)

## Acceptance
- [ ] User can toggle theme on all shell surfaces
- [ ] Exceptions documented for immersive play
- [ ] \`FUTURE.md\` no longer claims “no dark mode” for shell pages

## Plan section
Phase 3 in [docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md](https://github.com/moldovancsaba/narimato/blob/main/docs/GDS_OPTIONAL_IMPROVEMENTS_PLAN.md)" \
  "enhancement,gds-polish,area: ui,priority: P2,phase-gds" \
  "$STATUS_BACKLOG"

chmod +x "$(dirname "$0")/link-gds-sub-issues.sh" 2>/dev/null || true
"$(dirname "$0")/link-gds-sub-issues.sh" || bash "$(dirname "$0")/link-gds-sub-issues.sh"

echo ""
echo "Done. View board: https://github.com/users/moldovancsaba/projects/33"
echo "Re-run is idempotent (skips existing titles)."
