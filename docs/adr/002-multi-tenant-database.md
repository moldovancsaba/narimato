# ADR 002: Multi-tenant database architecture

**Status:** Accepted  
**Date:** 2026-05-23  
**Deciders:** Product owner  
**Issue:** [#17](https://github.com/moldovancsaba/narimato/issues/17)

## Context

NARIMATO will be operated as a **service** supporting multiple organizations, multiple projects, and multiple implementations. Documentation and setup scripts describe a master database plus per-organization databases selected at runtime. Application code today uses a single `connectDB()` call against `MONGODB_URI` with logical scoping via `organizationId` on documents only.

## Decision

**Path A — Implement physical per-organization database isolation** with master metadata DB and org-scoped connections.

- Master DB: organization registry (uuid, slug, `databaseName`, connection metadata)
- Per-org DB: cards, plays, rankings, and all tenant data for that organization
- Runtime: `buildOrgMongoUri()` (or equivalent) in `lib/db.js` + middleware/helpers to resolve connection from `organizationId`
- `ORGANIZATION_DB_URIS` optional override map for non-uniform Atlas layouts

Logical `organizationId` filtering remains defense-in-depth but is **not** the primary isolation boundary.

## Consequences

### Implementation (follow-on issues)

- Extend `lib/models/Organization.js` with `databaseName` (and fields needed by master registry)
- Implement connection cache and org routing in `lib/db.js`
- Update all API routes to obtain org-scoped connection before model access
- Align `scripts/setup-databases.js`, `init-master-db.js`, `init-default-org.js` with shared models
- Document operator setup in unified spec §5

### Documentation

- Remove “single-DB MVP” as target state from WARP/unified doc once routing ships
- Until implementation merges, docs may note “ADR 002 accepted; routing in progress”

## Constraints

- MongoDB Atlas `mongodb+srv://` only (existing `lib/db.js` policy)
- No cross-tenant queries without explicit super-admin tooling (future issue)

## Risks

- Missed `connectDB()` call sites → cross-tenant data leak (mitigate with audit grep + smoke tests)
- Migration of existing single-DB deployments → separate migration runbook

## Acceptance

- `buildOrgMongoUri` (or named equivalent) exists and is used by play/cards/org APIs
- Creating two orgs in master DB yields isolated card/play data
- Unified doc and WARP describe implemented behavior, not scripts-only fiction
