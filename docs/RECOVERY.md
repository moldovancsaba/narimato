# NARIMATO — Data Recovery Runbook (OPS-03)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](DEFINITION_OF_DONE.md) · [Issue index](ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [OPS-03](https://github.com/moldovancsaba/narimato/issues/40) · [OPS-01](https://github.com/moldovancsaba/narimato/issues/38) · [REL-01](https://github.com/moldovancsaba/narimato/issues/45)
<!-- delivery-ssot:end -->

NARIMATO keeps the only copy of every pilot in `DATA_DIR`: `world.json` (planet 0), the
`planets/pN/world.json` files and the `planets/registry.json` token→planet map. A callsign token is
the only reconnect credential, so losing the registry orphans pilots and losing a world file loses
their score and ownership. This runbook is the rehearsed path back.

The tooling is three zero-dependency Node scripts plus a drill:

| Tool | Purpose |
|---|---|
| `scripts/backup-data.mjs` | deterministic, checksummed `.tar.gz` + manifest |
| `scripts/verify-data.mjs` | read-only integrity verdict (one line) |
| `scripts/restore-data.mjs` | staged, verified, atomic restore |
| `scripts/recovery-test.mjs` | backup → verify → restore drill on throwaway data |

Shared pure logic lives in `lib/data-integrity.js`; server-side quarantine and registry
reconciliation live in `lib/world-core.js` and `lib/planet-manager.js`.

## Topology

```text
DATA_DIR/
├── world.json                     planet 0  (PERSIST_VERSION 2: players + sparse tree)
├── planets/
│   ├── registry.json              { version: 1, tokens: { <token>: <planetIndex> } }
│   ├── p1/world.json              planet 1
│   └── pN/world.json              planets 2..n, created on escape
└── world.json.corrupt-<stamp>     quarantine (startup refusal evidence)
```

`DATA_DIR` must be 0700 and the JSON files 0600: they contain tokens and callsigns. Backups carry
the same secrets; the backup directory is 0700 and the archive and manifest are 0600, and no token
is printed by any script.

## Recovery objectives

| Objective | Value | Derivation |
|---|---|---|
| RPO | ≤ 5.5 min | `max(SAVE_DEBOUNCE_MS, backupInterval) + flushWindow = max(0.5, 5) + 0.5` |
| RTO | ≤ 15 min | detect, restore, boot, smoke |
| Restore + verify | ≤ 10 min for `DATA_DIR` ≤ 50 MB | measured locally; use `--max-bytes` for larger trees |
| Retention | 7 daily + 24 hourly | `planRetention()` (union; newest always kept) |

RPO assumes a 5-minute backup interval (host cron or scheduler). Checksums detect corruption, not
tampering; backups are host-local, so host loss loses both copies.

## Backup

```bash
node scripts/backup-data.mjs --data-dir /var/lib/narimato --out /var/backups/narimato
# BACKUP /var/backups/narimato/narimato-<version>-<UTC stamp>-<digest8>.tar.gz files=… players=… tokens=…
```

- The archive is deterministic: sorted entries, mtime 0, uid/gid 0 and fixed modes, so identical
  input yields identical bytes (gzip header carries no timestamp).
- The manifest is written at the archive root and beside it as `<archive>.manifest.json`; it lists
  every file with `bytes` + `sha256`, the app version, the persistence version and per-planet
  `players`/`tokens` counts.
- Writes are temp-file → `fsync` → `rename` → directory `fsync`; the archive is never partially
  visible.
- Backups skip dotfiles, `*.tmp` leftovers and interrupted `*.staging-*`/`*.pre-restore-*` dirs.
- A corrupt `world.json` makes the backup fail with exit `4` instead of producing a silent bad
  archive: restore a good backup first.
- `--prune` applies the retention plan after a successful backup; without it nothing is deleted.

## Verify (read-only)

```bash
node scripts/verify-data.mjs --archive /var/backups/narimato/narimato-….tar.gz
# OK /path/to.tar.gz files=4 bytes=… app=3.57.0 persist=2 planets=2
```

Verify rejects absolute paths, `..` segments and any non-regular tar entry (symlinks are refused),
compares size + sha256 for every manifest entry, requires the sidecar manifest to match the archive
root manifest, and refuses a `persistVersion` newer than this build.

## Restore

```bash
# Plan only — writes nothing.
node scripts/restore-data.mjs --backup <archive> --data-dir /var/lib/narimato --dry-run

# Real restore (destructive): requires both --apply and --yes.
node scripts/restore-data.mjs --backup <archive> --data-dir /var/lib/narimato --apply --yes
```

`restore-data.mjs`:

1. refuses while a server answers `GET /api/health` on `--port` (default `PORT` or 4173; `--port 0`
   or `--no-server-check` skips the probe);
2. verifies the archive (exit `4` on any digest/path/symlink failure);
3. extracts into `DATA_DIR.staging-<pid>-<rand>` (0700 dirs, 0600 files) and re-hashes every file
   from disk;
4. reconciles the registry against the restored worlds and rewrites `registry.json` when needed;
5. swaps with two renames: `DATA_DIR → DATA_DIR.pre-restore-<UTC stamp>`, then
   `staging → DATA_DIR`. A failure before the swap deletes staging and leaves the live directory
   byte-identical.

The printed report is `RESTORED players=N tokens=N repaired=N` plus the retained
`DATA_DIR.pre-restore-…` path (the rollback target). `--json` emits the machine-readable report
including `playersBefore`, `playersAfter` and the reconcile counters.

Exit codes (all scripts): `0` ok · `2` usage · `3` nothing to restore/verify · `4` integrity ·
`5` schema newer than this build · `6` refused (live server, missing `--yes`, unsafe target) ·
`7` I/O.

### Registry/world reconciliation

Applied on restore and on every server boot (`PlanetManager.reconcileRegistry()`; report on
`lastReconcileReport`):

- a token routed to a planet directory that no longer exists is routed to planet 0 (keeps the
  reconnect identity), and is dropped on a later pass if no player record exists;
- a token absent from the players of a planet that still exists is dropped;
- a player without a registry entry is added;
- a token present on two planets keeps its recorded route when that planet is one of them
  (escape leaves an offline clone on the previous planet), otherwise the lowest live index;
- a corrupt non-zero planet file skips the pass instead of dropping tokens it may still own.

When `planets/registry.json` is missing while worlds exist, the restore rebuilds it from the world
files (`added` = every token found).

## Corruption and empty-boot guard

A present-but-corrupt `world.json` (invalid JSON, empty file, non-object, or corrupt player
entries) is renamed to `world.json.corrupt-<UTC stamp>` and startup is refused with
`WORLD_CORRUPT`; the last good copy is never overwritten by a fresh empty world. A corrupt tree
(valid players) still resets only the grid and keeps the pilots. A `world.json` whose `version` is
newer than `PERSIST_VERSION` throws `SCHEMA_TOO_NEW` without renaming anything.

Booting empty is an explicit, logged decision:

```bash
ALLOW_EMPTY_WORLD=1 node server.js
```

Use it only after the corrupt file is quarantined and there is no usable backup; the quarantined
file remains on disk for forensics.

## Upgrade / rollback order

1. Stop the server (`SIGTERM` flushes the debounced save).
2. `node scripts/backup-data.mjs …` and `node scripts/verify-data.mjs …`.
3. `git checkout <previous tag>` / deploy the previous binary **without** restoring data first — a
   same-or-newer `PERSIST_VERSION` is read normally.
4. Restore only if the previous binary reports `SCHEMA_TOO_NEW` or the data is corrupt:
   `restore-data.mjs --apply --yes` (keep the `.pre-restore-…` directory).
5. Start `node server.js`, then smoke: `GET /api/health`, `GET /api/state`, one rejoin with a known
   token, `/api/metrics` `playersTotal` matches the manifest.

Rollback of a bad restore: stop, move the current directory aside, rename the retained
`DATA_DIR.pre-restore-…` back to `DATA_DIR`, start, verify `/api/health`. The scripts themselves
are reverted with `git revert`; they change no schema, so no data migration is involved.

## Drill

Run the rehearsal on throwaway data (never against production):

```bash
npm run recovery:test
# drill: PASS — players, tokens and world counters survived backup/verify/restore.
```

The drill boots a server, creates three pilots and world state, stops it, runs backup → verify →
restore into a new directory, boots the restored world and asserts players, tokens, click counters
and token-based rejoin identity. Record each production drill (date, commit, result) in
[RELEASE_NOTES.md](../RELEASE_NOTES.md) — this document owns the procedure, not the status.

Manual verification after any real recovery:

```bash
node scripts/recovery-test.mjs
curl -s http://localhost:4173/api/health
curl -s http://localhost:4173/api/metrics | grep -o '"playersTotal":[0-9]*'
```

## Known limitations

- Host-local backups: host loss loses both copies; ship a copy off-host.
- Checksums detect corruption, not tampering.
- Restore requires a stopped server; there is no online restore.
- The swap is two renames, so there is a sub-second window without a `DATA_DIR`; the retained
  directory is the recovery point.
- Quarantine/restore are operator commands, deliberately not an operator dashboard (the CLI is the
  surface).

## Related documents

- [ARCHITECTURE.md](../ARCHITECTURE.md) — data model, persistence, deployment.
- [OBSERVABILITY.md](../OBSERVABILITY.md) — health/metrics and SLO checks after recovery.
- [LOAD_TEST.md](../LOAD_TEST.md) — chaos/restart baseline and the SLO gate.
