# ADR-0001: Zero npm runtime dependencies

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: SSOT-01, OPS-03

## Context

NARIMATO ships as readable source: `npm start` runs `node server.js`, which serves the static
client and the authoritative HTTP/SSE API. Players join from a browser with no install, no build
step and no third-party runtime assets. The repository has no `dependencies` and no lockfile;
voice clips, screenshots and generated assets are committed. CI runs `npm test` with Node 20/22.

A 2026 delivery audit treated the absence of dependencies as a constraint that must survive the
adoption of the Sovereign Squad General Design System for UI work (ADR-0002). A UI framework
dependency cannot be allowed to introduce a runtime install step for players or operators.

## Decision

The production runtime keeps **zero npm dependencies**:

- `server.js` and `lib/*` use only Node built-ins.
- The client ships pre-built static assets; `npm start` never installs or bundles at runtime.
- `package.json` may carry **devDependencies** only for build, test and audit tooling
  (for example a Vite/React build for GDS islands, Playwright and axe).
- Generated UI bundles are committed under `public/` together with their cache-bust version,
  so a deployment is still "copy the repository and run `node server.js`".
- CI installs devDependencies to verify the build; production does not need them.

## Consequences

- Players and operators keep the one-command local run; offline/edge deployment stays simple.
- The repository grows with committed build output; it must be reviewed, versioned and
  reproducible from the pinned dev toolchain.
- Server code cannot lean on npm libraries; observability, persistence and protocol helpers are
  implemented in-repo and tested with `node:test`.
- A future dependency requires a superseding ADR with a measured operational benefit.

## Alternatives considered

- **Server-side framework or ORM**: rejected; JSON files plus an authoritative in-memory core are
  sufficient and auditable at the current scale.
- **CDN-hosted client framework at runtime**: rejected; it adds a third-party network dependency
  and breaks offline/self-hosted play.
- **No build tool at all**: rejected for GDS adoption; the design system is React-based, so a
  dev-time build is the smallest compliant bridge.

## Links

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — stack, runtime topology and deployment.
- [ADR-0002](0002-gds-react-island-boundary.md) — the only approved UI framework boundary.
- [docs/SSOT.md](../SSOT.md) — delivery SSOT rules.
- Issues: [SSOT-01](../ISSUE_MAP.md), [OPS-03](../ISSUE_MAP.md).
