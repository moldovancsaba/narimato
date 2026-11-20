# ADR-0005: JSON-file persistence with atomic rename

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: OPS-03

## Context

The authoritative server must persist worlds, players, tokens, ore inventories and the token →
planet registry across restarts, on a single machine, with no external database and no npm
dependencies (ADR-0001). Load measurements show a single Node process is below the SLO gate
(`LOAD_TEST.md`), so scale-out is not yet justified.

Current implementation: one JSON file per planet plus a registry file, written with a serialized
temp-file + rename, debounced per planet, flushed on graceful shutdown. Writes are not fsynced;
a corrupt file is read as a fresh world (`readJsonSafe`), so a bad write can be overwritten by the
next save.

## Decision

- Persistence stays **JSON files under `DATA_DIR`**, one file per planet plus
  `DATA_DIR/planets/registry.json`; no database, no WAL, no external service.
- Every write uses the atomic temp-file + rename path, serialized per planet; shutdown flushes.
- Versioned schema (`PERSIST_VERSION`) with migration on load; unknown/corrupt files are
  quarantined rather than silently reinitialized once the recovery runbook lands (OPS-03).
- Backup, verify, restore and rollback are **operational requirements**, not optional: a
  checksummed backup, read-only verify, staged restore and documented RPO/RTO are part of
  delivery before any persistence change is called complete.
- Data files are never committed to git (`data/` is ignored); tokens are secrets.

## Consequences

- Deployment remains a directory copy plus a Node process; backup/restore is a file operation.
- The whole world must fit in memory; this bounds the supported planet/player count until a
  sharding decision is measured (OPS-05).
- Durability is bounded by the debounce window and the absence of fsync; the recovery runbook
  must state the real RPO and a future ADR is required before claiming stricter guarantees.
- Corruption handling is critical because a fresh-world boot can destroy evidence; quarantine
  and preflight verification are mandatory companions.

## Alternatives considered

- **SQLite (built-in Node `node:sqlite`)**: plausible future option, but adding it now changes
  the deployment/runtime contract and was not measured as needed.
- **External database**: rejected; violates the zero-runtime-dependency and self-hosted goals.
- **Append-only log with compaction**: deferred; more machinery than the measured scale needs.

## Links

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — persistence model, atomic writes and migration.
- [LOAD_TEST.md](../../LOAD_TEST.md) — measured single-process capacity gate.
- Issues: [OPS-03](../ISSUE_MAP.md), [OPS-05](../ISSUE_MAP.md).
