## Issue

Closes #<!-- issue number -->

## What changed

<!-- One issue's scope. List the concrete changes. -->

## Evidence

- Tests: `npm test` / focused test output
- Browser/acceptance: screenshots, Playwright output, artifacts
- Accessibility/GDS (UI changes): axe result, keyboard/SR checks, GDS compliance
- Ops/observability (runtime changes): metric/SLO evidence

## Rollback

<!-- Concrete revert steps: code, asset/version, data/configuration. -->

## Checklist

- [ ] The change belongs to exactly one board issue (linked above) and stays in scope.
- [ ] `npm test` and `npm run docs:check` pass locally.
- [ ] UI/UX/frontend uses only the Sovereign Squad General Design System; accessibility is verified.
- [ ] Server remains authoritative; no client-fabricated resources or state.
- [ ] Documentation updated where durable knowledge changed; board evidence fields will be filled.
- [ ] No secrets, credentials, private URLs or unverifiable delivery claims.
