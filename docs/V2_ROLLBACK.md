# NARIMATO v2 — phase links and rollback

Every delivery phase has its own tag, link and rollback command. The legacy game is **retired from
the product entry point but preserved** under its tag so any phase can be restored.

## 0. Public online build (no install)

- **Play now:** https://moldovancsaba.github.io/narimato/
- **Online phase index:** https://moldovancsaba.github.io/narimato/phases.html
- **Online delivery phases:**
  - https://moldovancsaba.github.io/narimato/phase-0.html
  - https://moldovancsaba.github.io/narimato/phase-1.html
  - https://moldovancsaba.github.io/narimato/phase-2.html
  - https://moldovancsaba.github.io/narimato/phase-3.html
  - https://moldovancsaba.github.io/narimato/phase-4.html
- **Online camera phases:** `/?phase=0` … `/?phase=3` on the Pages URL.

The Pages build runs the same rules with a browser-state fallback (no Node API); the Node build
(`npm start`) keeps server authority. Both are playable; use the public build for try/test.

## 1. Product entry points

- **v2 game (new product):** `node v2/server.js` or `npm start` → `http://127.0.0.1:4180/`
- **Implementation phase pages** (each phase has its own live page):
  - Phase 0 — `http://127.0.0.1:4180/phase/0`
  - Phase 1 — `http://127.0.0.1:4180/phase/1`
  - Phase 2 — `http://127.0.0.1:4180/phase/2`
  - Phase 3 — `http://127.0.0.1:4180/phase/3`
  - Phase 4 — `http://127.0.0.1:4180/phase/4`
- **Camera phase links** (each phase has its own URL):
  - Phase 1 orbit — `/?phase=0` → [open](http://127.0.0.1:4180/?phase=0)
  - Phase 2 halfway — `/?phase=1` → [open](http://127.0.0.1:4180/?phase=1)
  - Phase 3 80% — `/?phase=2` → [open](http://127.0.0.1:4180/?phase=2)
  - Phase 4 landed — `/?phase=3` → [open](http://127.0.0.1:4180/?phase=3)
  - Phase index page — `http://127.0.0.1:4180/phases.html`
- **Legacy game (retired, rollback only):** `npm run start:legacy` → old server.

## 2. Delivery phases — tag links

| Phase | What it contains | Tag / tree link | Rollback |
|---|---|---|---|
| Phase 0 | clean v2 scaffold, server, tests | [v2-phase-0](https://github.com/moldovancsaba/narimato/tree/v2-phase-0) | `git checkout v2-phase-0` |
| Phase 1 | planet geometry + approved one-rig camera (4 phases) | [v2-phase-1](https://github.com/moldovancsaba/narimato/tree/v2-phase-1) | `git checkout v2-phase-1` |
| Phase 2 | server-authoritative collecting: 10 triangles × 3 breaks, 30/30, next planet | [v2-phase-2](https://github.com/moldovancsaba/narimato/tree/v2-phase-2) | `git checkout v2-phase-2` |
| Phase 3 | playable client: clickable triangles, 4 robots + respawn, HUD, visible gamer | [v2-phase-3](https://github.com/moldovancsaba/narimato/tree/v2-phase-3) | `git checkout v2-phase-3` |
| Phase 4 | cutover/retirement docs, phase links, legacy tag | [v2-phase-4](https://github.com/moldovancsaba/narimato/tree/v2-phase-4) | `git checkout v2-phase-4` |
| Phase 5 | final camera/landing/controls + status/rollback docs | [v2-phase-5](https://github.com/moldovancsaba/narimato/tree/v2-phase-5) | `git checkout v2-phase-5` |
| Phase 6 | non-Euler pole-free quaternion movement | [v2-phase-6](https://github.com/moldovancsaba/narimato/tree/v2-phase-6) | `git checkout v2-phase-6` |
| Phase 7 | pointer point-follow + automated camera acceptance + denser surface | [v2-phase-7](https://github.com/moldovancsaba/narimato/tree/v2-phase-7) | `git checkout v2-phase-7` |
| Phase 8 | final triangle/actor hierarchy, surface Bézier, 1.02 R camera | [v2-phase-8](https://github.com/moldovancsaba/narimato/tree/v2-phase-8) | `git checkout v2-phase-8` |
| Phase 9 | mandatory slerp arc renderer restored + higher surface camera/mouse dolly | [v2-phase-9](https://github.com/moldovancsaba/narimato/tree/v2-phase-9) | `git checkout v2-phase-9` |
| Live v2 | accepted v2 product | [v2-live](https://github.com/moldovancsaba/narimato/tree/v2-live) | `git checkout v2-live` |
| Approved playtest | user-approved 2026-11-26 build `e7f65e5` | [v2-approved-2026-11-26](https://github.com/moldovancsaba/narimato/tree/v2-approved-2026-11-26) | `git checkout v2-approved-2026-11-26` |
| Legacy | old game, retired, preserved for rollback | [legacy-v3.58.0-retired](https://github.com/moldovancsaba/narimato/tree/legacy-v3.58.0-retired) | `git checkout legacy-v3.58.0-retired` + `npm run start:legacy` |

## 3. How to go back if something is wrong

1. Identify the phase from the table above.
2. `git checkout v2-phase-N` (or the legacy tag).
3. `node v2/server.js` (or `npm run start:legacy` for the old game).
4. Verify the phase URL (`/?phase=0..3`) and the phase acceptance test.
5. To return to the latest: `git checkout main && npm start`.

No database migration is involved: v2 state is in memory and resets on restart. Legacy data stays in
its existing data directory and is untouched.

## 4. Phase acceptance

- Before each phase tag: `npm test` must pass; docs gate must pass.
- Phase 2/3 gameplay acceptance: collect 30 breaks → planet index increments and progress resets to 0/30;
  four robots tick, and each respawns after reaching 5.
- Phase 1 camera acceptance: four phase URLs render the approved distances/pitches; horizon at 10%;
  no masks/cuts/zoom/second camera.
- Release evidence: [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md) and the CI run linked on the merge PR.

## 5. Retirement status

- **Legacy game:** retired from `npm start`; frozen at `legacy-v3.58.0-retired`; not deleted.
- **v2:** new product entry; simple loop only — triangles, four robots, collect 30, next planet.
- Any rollback to legacy must not reintroduce old features into v2.
