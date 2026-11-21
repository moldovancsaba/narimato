# NARIMATO — Release evidence ledger (REL-02)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](DEFINITION_OF_DONE.md) · [Issue index](ISSUE_MAP.md).
> This document owns durable knowledge; it does not track mutable delivery status. The board is the
> only status record.
>
> **Related delivery issues:** [REL-01](https://github.com/moldovancsaba/narimato/issues/45) · [REL-02](https://github.com/moldovancsaba/narimato/issues/46) · [A11Y-02](https://github.com/moldovancsaba/narimato/issues/13) · [OPS-04](https://github.com/moldovancsaba/narimato/issues/41) · [TST-01](https://github.com/moldovancsaba/narimato/issues/25)
<!-- delivery-ssot:end -->

A release note is a promise. This ledger makes every promise falsifiable: each claim
is one row, each row has one status from a closed vocabulary, and every `LIVE` row
points at evidence that resolves inside this repository. `npm run evidence:check`
validates the project tables and the release gate runs it as a blocking step.

## 1. Claim schema

```ts
type ClaimStatus = "LIVE" | "PARTIAL" | "PLANNED" | "NOT_STARTED";
type EvidenceKind = "commit" | "test" | "script" | "screenshot" | "smoke" | "issue";
type Evidence = { kind: EvidenceKind; ref: string };
type Claim = { text: string; status: ClaimStatus; evidence: Evidence[]; note?: string };
```

One row per capability, not per sentence. Split compound claims (`gate and ledger`)
into two rows so a reader can tell which half is shipped.

| Column | Rule |
|---|---|
| Claim | Capability name, one capability only; present tense only when the status is `LIVE` or `PARTIAL`. |
| Status | Exactly `LIVE`, `PARTIAL`, `PLANNED` or `NOT_STARTED`. Anything else is exit `1`. |
| Evidence | Zero or more typed references separated by commas: `test:test/x.test.js`, `script:scripts/x.mjs`, `commit:<sha>` (literal 7–40 hex characters), `screenshot:media/x.png`, `smoke:media/x.json`, `issue:#N`. |
| Note | Required for `PARTIAL` (names what remains). Free text for the others; a planned row must not contain a present-tense shipping verb. |

Evidence kinds and resolution:

| Kind | Resolves against | Failure |
|---|---|---|
| `commit:` | `git cat-file -e <sha>^{commit}` in this repository | exit `2` |
| `test:` | file exists under the repository root | exit `2` |
| `script:` | file exists under the repository root | exit `2` |
| `screenshot:` | file exists under the repository root | exit `2` |
| `smoke:` | local smoke artifact exists; external URLs are refused | exit `2` |
| `issue:` | the issue number appears in [ISSUE_MAP.md](ISSUE_MAP.md) | exit `2` |

Relative Markdown links inside a claim row must resolve; a broken link is exit `3`.
A `PLANNED` or `NOT_STARTED` row whose claim or note uses `ships`, `is live`,
`delivers`, `supports now`, `now supports`, `works today`, `available now`,
`is available` or `runs live` is exit `4` unless the sentence is explicitly negated.

## 2. Status vocabulary

| Status | Means | Minimum evidence |
|---|---|---|
| `LIVE` | The capability is shipped in this release and exerciseable from the repository. | At least one resolving reference. |
| `PARTIAL` | Something ships, but the note names the missing half. Not a synonym for "mostly done". | Note naming what remains; evidence for the shipped half. |
| `PLANNED` | Approved work that is not shipped. Future tense. | An owning issue reference is recommended; no fabricated artifact. |
| `NOT_STARTED` | Approved scope with no implementation. | An owning issue reference. |

Rules that keep the vocabulary honest:

- A capability gated on an external credential, an unverified device or a missing
  approval is never `LIVE`; use `PLANNED` and name the blocker issue.
- A merged implementation with no exercised evidence is `PARTIAL` at most.
- A green unit test does not prove a browser, device or production claim. Use the
  matching evidence kind, or split the claim.
- Historical release-note entries are annotated, never deleted. Their counts and
  claims describe that release, not the current suite.

## 3. How to fill the board fields

The board fields carry status; this document carries the durable rules and the
release ledger. On the owning issue, after the evidence exists:

| Field | Fill with |
|---|---|
| `Delivered` | One or two sentences naming the shipped outcome, the commit SHA, and the PR URL. Example: "REL-01 release gate: `npm run release:gate` runs the matrix and writes `release-manifest.json`; commit `<delivery-sha>`, PR #N." |
| `Release Evidence` | The gate verdict and exit code, the manifest and report paths, the executed test count, and the docs/a11y/load evidence paths. Example: "Gate BLOCKED (exit 5) on A11Y-02/OPS-04; code gates PASS; 603/603 tests; manifest `artifacts/release/v3.58.0/release-manifest.json`." |
| `Documentation` | The exact repository paths changed, for example `docs/RELEASE_EVIDENCE.md`, `RELEASE_NOTES.md`, `docs/SSOT.md`. |
| `Next Action` | The next concrete unblocker; for a blocked release name the external owner and the evidence required. Example: "A11Y-02 owner links the device matrix; OPS-04 owner links the stub-origin report; rerun `npm run release:gate`." |

Do not write "done", "delivered" or "live" in any field while the gate reports
`BLOCKED` or `RED`. A plan, a branch, a green build or a checklist is not evidence.

## 4. Verification commands per claim class

| Claim class | Command | Expected |
|---|---|---|
| Test-backed code | `node --test test/<file>.test.js` or `npm test` | exit `0`, named tests pass |
| Script-backed gate/tool | `node scripts/<tool>.mjs --help` or the documented run command | exit `0` and a machine-readable artifact |
| Commit-backed history | `git cat-file -e <sha>^{commit}` | exit `0` |
| Screenshot / recording | `test -f media/<path>` | exit `0` |
| Smoke artifact | `test -f artifacts/release/v3.58.0/<artifact>` | exit `0` |
| Issue-backed scope | `gh issue view <N> --repo moldovancsaba/narimato` | issue exists and matches the claim |
| Whole ledger | `npm run evidence:check` | exit `0`; `LIVE` coverage 100 %, stale references 0 |
| Whole release | `npm run release:gate` | exit `0` GREEN; exit `5` BLOCKED on external prerequisites; exit `1`/`4` red |

## 5. Release procedure

1. Bump the version with `node scripts/check-version.mjs --bump X.Y.Z`; update the
   audio cache key with the generated narration manifest if the spoken text changed.
2. Run `npm test`, update the generated test-count markers, then `npm run docs:check`.
3. Add or update the claim rows in `README.md`, the current `RELEASE_NOTES.md`
   section and this ledger. Use the exact status that the evidence supports.
4. Run `npm run evidence:check`; fix every violation before the release gate.
5. Run `npm run release:gate`; commit the generated acceptance/single-scene evidence
   and fill the board fields from the manifest. A `BLOCKED` verdict is a real
   verdict: do not edit the gate or the prerequisite file to make it green.
6. Re-run the gate after the evidence commit, attach the report to the PR, and leave
   the owning issues open while external prerequisites remain unmet.

## 6. Current release ledger — v3.58.0

| Field | Value |
|---|---|
| Release | v3.58.0 — "Release Gate" |
| Base commit | `8d79afa` (main before REL-01/REL-02 delivery) |
| Delivery commits | `1002805`, `3d91dce`, `3328f4d`, `e5ef0e4` on `delivery/rel-01-02` (rebased onto `a4a4118`) |
| Delivery scope | REL-01 release gate, REL-02 evidence ledger, TST-01 acceptance fix |
| Version SSOT | `package.json` 3.58.0 · cache-bust 3.58.0 · README 3.58.0 · notes heading v3.58.0 |
| Audio cache key | `3.58.0+56190bd8` (content hash unchanged; spoken text did not change) |
| Executed suite | 603 tests, 603 pass, 0 fail (`node:test`) |
| Docs gate | pass: 42 markdown files, 889 links, 0 findings (`npm run docs:check`) |
| Headless accessibility | Chromium gate clean: 9 surfaces, 0 failure, 0 warning, 0 incomplete |
| Browser acceptance | single-scene self-test, two-client 7/7, surface-truth 4/4 (TST-01 exit contract fixed) |
| Load / chaos | fast profile `smoke` + `chaos` PASS; **120.02-minute soak PASS** for `cb65df9` (artifact `artifacts/gate/soak/summary.json`) |
| Rollback drill | previous tag v3.57.0; previous suite 116 tests; schema 2 → 2; PASS |
| Release gate verdict | BLOCKED (exit 5) on A11Y-02/OPS-04 only — all code gates green |
| Gate run | `npm run release:gate` at `PLAYWRIGHT_MODULE=/tmp/dsh-pw/node_modules/playwright`; 277 s; manifest commit recorded in the artifact |
| Gate artifacts | `artifacts/release/v3.58.0/release-manifest.json`, `release-report.md`, `logs/`, `a11y/`, `load/`, `rollback-drill.json` |

Claim ledger for this release (the checker parses this table):

| Claim | Status | Evidence | Note |
|---|---|---|---|
| One-command release acceptance gate | LIVE | `script:scripts/release-gate.mjs`, `test:test/release-gate.test.js` | Runs the matrix in dependency order and writes a versioned manifest |
| Version and cache-bust SSOT | LIVE | `script:scripts/check-version.mjs`, `test:test/version.test.js` | package.json, cache-bust, README and release heading agree |
| Documented test-count consistency | LIVE | `script:scripts/test-count.mjs`, `test:test/test-count.test.js` | Markers and current-release prose must equal the executed suite |
| Evidence ledger and planned-as-live check | LIVE | `script:scripts/evidence-check.mjs`, `test:test/evidence-check.test.js` | Closed vocabulary, typed references, exit 4 for tense violations |
| TST-01 acceptance exit-code contract | LIVE | `script:scripts/acceptance-surface-truth.mjs`, `test:test/acceptance-harness.test.js` | PASS now exits 0; expected 409 NOT_A_LEAF is not a page error |
| Single-scene acceptance | LIVE | `script:scripts/verify-single-scene.mjs`, `test:test/single-scene-guard.test.js` | Camera-only transition, parity, frame budget |
| Two-client surface acceptance | LIVE | `script:scripts/acceptance-two-client-surface.mjs`, `test:test/renderer-surface.test.js` | Peer visibility, authoritative beams, supply focus, live mutation |
| GDS headless accessibility gate | LIVE | `script:scripts/a11y-gate.mjs`, `test:test/a11y-report.test.js` | Chromium and WebKit engines; zero serious/critical findings |
| Load and chaos gate | LIVE | `script:scripts/perf-gate.mjs`, `test:test/perf-gate.test.js` | OPS-02 scenarios and thresholds |
| Persistence recovery drill | LIVE | `script:scripts/recovery-test.mjs`, `test:test/recovery.test.js` | Backup, verify, restore and token rejoin |
| Binary rollback drill | LIVE | `script:scripts/rollback-drill.mjs`, `test:test/release-gate.test.js` | Previous-tag worktree, suite, schema compatibility, RTO |
| Real-device gate procedure | LIVE | `script:scripts/device-gate.mjs`, `test:test/device-gate.test.js` | Plan/check matrix, evidence provenance and approval validation |
| Physical-device accessibility sign-off | PARTIAL | `issue:#13`, `script:scripts/device-gate.mjs` | The 20-row ledger is not executed on hardware; two approvals remain (A11Y-02) |
| CDN preflight gate | LIVE | `script:scripts/cdn-preflight.mjs`, `test:test/cdn-preflight.test.js` | Fail-closed policy, CORS/range/cache and production-host checks |
| Edge/CDN asset delivery | PLANNED | `issue:#41`, `script:scripts/cdn-preflight.mjs` | Activation will follow the real CDN hostname and credentials (OPS-04) |
| 120-minute soak for this release | LIVE | `script:scripts/perf-gate.mjs`, `commit:cb65df9` | 120.02 min PASS for `cb65df9`: HTTP p95 1 ms, loop p95 22.053 ms, 0 dropped SSE, 0 errors, join p95 3.23 ms, click p95 11.27 ms, RSS growth 0; the clamped 60-min attempt is retained as invalid |

## 7. External blockers for this release

Fresh verification (2026-11-21): `npm run release:gate` on `41c884f` (v3.58.0) reproduced BLOCKED (exit 5) on A11Y-02/OPS-04 only, with all 14 code gates PASS in 280 s; artifacts `artifacts/release/v3.58.0/`.

| ID | Issue | Owner | Status | Required evidence |
|---|---|---|---|---|
| A11Y-02 | #13 | accessibility-lead | blocked (issue open, evidence unmet) | executed `docs/device-gate/EVIDENCE.json`, defect links and two approvals |
| OPS-04 | #41 | platform-ops | open | `cdn:preflight` report against the real hostname and the `ASSET_BASE_URL` rollback proof |
| SOAK | #39 | platform-ops | satisfied — 120.02-minute PASS for `cb65df9` | `artifacts/gate/soak/summary.json` (the earlier clamped 60-minute run is invalid and not counted) |

The machine-readable twin is `observability/release-prerequisites.json`; the release
gate validates it and reports `BLOCKED` while a blocking row is not `satisfied`. Do
not mark a row satisfied without linking the evidence above.

## 8. Working rules

- Refreshing the ledger is part of the REL-01 procedure, not a follow-up.
- A renamed test or deleted screenshot makes a `LIVE` row fail the checker until the
  reference is updated; fix the evidence, not the checker.
- A squashed or rewritten commit makes a `commit:` reference stale; replace it with
  the surviving SHA and annotate the row.
- Pre-ledger history is annotated `PARTIAL` with "evidence not retained"; it is never
  rewritten into a claim that was not recorded.
- The checker performs no network calls and executes no repository script; it reads
  files and asks local git for commit existence only.
