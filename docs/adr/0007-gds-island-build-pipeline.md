# ADR-0007: GDS island build pipeline — deterministic dev-time bundle with committed output

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: UI-01

## Context

ADR-0002 accepts a dev-time React island as the only approved way to consume `@sovereignsquad/gds`
in this React-free, bundler-free, zero-runtime-dependency game. It does not fix the concrete build
pipeline, the committed artefact contract, the budget enforcement or the failure/rollback mechanics.
UI-01 must deliver those, and every later UI migration inherits them.

Constraints at decision time:

- `npm start` must keep working with no install, so the runtime cannot resolve `node_modules`.
- Build output must be committed under `public/ui/` because `dist/` is gitignored and the static
  handler is unchanged.
- Two consecutive builds must be byte-identical; CI must prove the committed output matches sources.
- The mandated GDS stylesheet is the full Mantine component stylesheet (about 47 KiB gzip when the
  remote font import is kept), and the issue sets a 40 KiB CSS gzip budget.
- React 19 plus one `GdsProvider` is about 160 KiB gzip before any component; the issue sets a
  180 KiB hard JavaScript budget with a 140 KiB target.
- No `eval`, no remote fonts, no third-party runtime requests; output must survive a strict CSP.
- Exactly one provider, one React root, one stylesheet link, and a one-action kill switch.

## Decision

Adopt a dev-time Vite library build with deterministic post-processing and committed output:

1. `ui/src/main.jsx` is the only entry. Vite library mode (ES2020, JSX automatic, no hashed file
   names) emits `public/ui/island.js` and `public/ui/island.css` unminified and deterministic.
2. `scripts/build-ui.mjs` post-processes the emitted files: one esbuild minification pass over the
   final concatenated bundle (Vite's Rollup-phase minification leaves about 11% gzip behind), the
   remote Google Fonts `@import` is stripped from the GDS stylesheet, component CSS whose class
   tokens never appear in the final bundle is pruned, then CSS is minified.
3. The manifest version is a content hash of the two assets with a build sentinel normalised around
   the embedded version string, so the contract is verifiable and not self-referential. `builtAt`
   is metadata and is not hashed.
4. `scripts/verify-gds-build.mjs` (`npm run verify:ui`) is the contract gate: manifest schema, hash
   equality, byte counts, gzip budgets, source rules (one provider, one root, GDS-only imports),
   mount contract (one `#gds-root`, one stylesheet link before app CSS, game entry preserved),
   deploy safety (no `eval`, no remote resources, no surviving bare imports).
5. CI adds a `gds-ui` job: install devDependencies, build, verify, compare committed assets with a
   fresh build, and prove two builds are byte-identical.
6. The page boot (`public/js/gds-adapter.js`, `public/js/gds-boot.js`) resolves flags, imports the
   island, retries once after 1 s, falls back to the legacy UI with a dismissible banner, and guards
   a stale chunk with one `sessionStorage` reload. `app.js` call sites are unchanged; the adapter
   maps the frozen `UI` API onto island store slices for the migration issues.

## Consequences

- The repository gains devDependencies, `package-lock.json` and a committed bundle; `npm ci` and
  `npm run build:ui` are required only for UI changes. `npm start`, `npm test` and the server stay
  dependency-free.
- The CSS budget is met (38.32 KiB gzip) by pruning unused Mantine component CSS rather than forking
  or weakening the mandated GDS stylesheet import. New components used by UI-02…UI-05 are kept
  automatically because pruning is computed from the final bundle on every build.
- The JavaScript hard budget is met (172.45 KiB gzip); the 140 KiB target is not, because of the
  provider's Mantine theme/notifications/modals/i18n runtime. This is documented as a known
  limitation rather than hidden by a weaker budget.
- A broken build blocks release; a broken runtime boot does not block the game.
- The GDS default font (Inter) is not loaded remotely; text falls back to the system font stack until
  theme-level self-hosting lands.

## Alternatives considered

- **Runtime CDN import of GDS/React**: rejected — third-party runtime request, no CSP-safe integrity
  story, and `npm start` would depend on the network.
- **Import maps + ESM from `node_modules`**: rejected — the unbuilt GDS package is not browser-ready,
  and the server would need to serve `node_modules`, breaking the zero-install runtime.
- **Web Components wrapper around GDS**: rejected — forks GDS behaviour and recreates its
  accessibility wiring; ADR-0002 already rejects it.
- **Commit the raw Vite output**: rejected — 204 KiB gzip JavaScript (over the 180 KiB hard budget)
  and 47 KiB gzip CSS (over the 40 KiB budget), plus a remote font import.
- **Import per-component Mantine CSS instead of the GDS stylesheet**: rejected — violates the
  GDS-only, one-stylesheet rule and the "no direct @mantine/core imports" boundary.
- **Raise the budgets to fit the first build**: rejected — the issue's hard budgets are the contract;
  the target shortfall is recorded instead.
- **A separate island server route with build-on-demand**: rejected — runtime build dependency,
  non-deterministic artefacts and no committed evidence.

## Links

- [ADR-0002](0002-gds-react-island-boundary.md) — GDS-only DOM UI through a dev-time React island
  boundary (the decision this pipeline implements).
- [ADR-0001](0001-zero-npm-runtime-dependencies.md) — zero runtime npm dependencies.
- [GDS integration guide](../GDS_INTEGRATION.md) — commands, contracts, flags, budgets, rollback.
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — client module ownership and topology.
- Issue: [UI-01](../ISSUE_MAP.md).
