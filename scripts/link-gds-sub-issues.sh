#!/usr/bin/env bash
# Link GDS child issues (#48–#50) as GitHub sub-issues of program #47.
# Idempotent: skips if already linked.
set -euo pipefail
REPO="moldovancsaba/narimato"
PARENT=47
CHILDREN=(48 49 50)

link_sub_issue() {
  local parent_num="$1"
  local child_num="$2"
  local child_dbid
  child_dbid=$(gh api "repos/$REPO/issues/$child_num" --jq .id)
  local existing_parent
  existing_parent=$(gh api graphql -f query="
    query { repository(owner: \"moldovancsaba\", name: \"narimato\") {
      issue(number: $child_num) { parent { number } }
    }}" --jq '.data.repository.issue.parent.number // empty' 2>/dev/null || true)
  if [[ "$existing_parent" == "$parent_num" ]]; then
    echo "SKIP: #$child_num already sub-issue of #$parent_num"
    return
  fi
  echo "{\"sub_issue_id\": $child_dbid}" | gh api "repos/$REPO/issues/$parent_num/sub_issues" -X POST --input - >/dev/null
  echo "LINKED: #$child_num → #$parent_num"
}

for n in "${CHILDREN[@]}"; do
  link_sub_issue "$PARENT" "$n"
done

gh api graphql -f query="
query {
  repository(owner: \"moldovancsaba\", name: \"narimato\") {
    issue(number: $PARENT) {
      subIssuesSummary { total completed percentCompleted }
      subIssues(first: 10) { nodes { number title } }
    }
  }
}" --jq '.data.repository.issue | {summary: .subIssuesSummary, subIssues: [.subIssues.nodes[] | .number]}'
