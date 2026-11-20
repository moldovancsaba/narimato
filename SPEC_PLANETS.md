# INFINITE PLANET PROGRESSION — implementation contract

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [SRV-01](https://github.com/moldovancsaba/narimato/issues/20)
<!-- delivery-ssot:end -->

Goal: after the escape mission is complete the pilot flies off the current planet, survives a
random storm/interlude, and lands on the next planet. Every planet is its own multiplayer scene
(players + robots only from that planet), has a bounded depth, finite mineral deposits, and a
meteor reset when exhausted. Infinite planets, random story each escape.

## Shared rules (`public/js/shared/mission.js` — frozen)

- `planetDepth(i) = min(2 + i, 8)`: planet 0 depth **2**, planet 1 depth **3**, planet 2 depth 4…
- `planetName(i) = "ICOSA-" + (9+i)`.
- `missionForPlanet(i)`: planet 0 = current escape mission; later planets require more ore
  (`uranium 3+2i`, `silver 5+3i`, `gold 2+i`, `palladium 1+i`).
- `missionProgress(oreCounts, missionForPlanet(i))` decides readiness server+client identically.
- Escape story is random per escape (server picks; client renders returned object):
  `{ id, title, tone, lines:[...] }` e.g. SPACE STORM / GRAVITY SLINGSHOT / PIRATE AMBUSH /
  WORMHOLE TREMOR / DERELICT BEACON. Include at least 8 variants.

## Server: multi-planet manager

New `lib/planet-manager.js`; `server.js` delegates to it. Keep `startServer()` return shape
backward-compatible (`core` = planet 0 core) for existing tests.

### Planet instances
- Planet 0: existing `DATA_DIR/world.json` (migration), depth 2. Planets 1+: directories
  `DATA_DIR/planets/p<i>/world.json` (or a single `planets.json`; either, but persistent).
- Each planet = its own `WorldCore` instance (own players, tree, robot, seed, revision, save).
- Config for planet i: `maxDepth = planetDepth(i)`; bots enabled as today (one robot per planet).
- **Planet 0 migration**: on first boot with no planet registry, load existing world, PRESERVE
  player objects (tag/color/token/score/ores/oreCounts) and reset the **grid** to a fresh depth-2
  planet (base 20 cells, fresh deposits/seed). Persist. Old deeper tree is replaced (requested
  first planet depth 2). If no existing world, start fresh depth 2.
- Load planets on demand (planet 0 at boot; others when a player arrives / registry references).
  Tick and pump all loaded planets.

### Registry & routing
- `DATA_DIR/planets/registry.json`: `{ tokens: { token: planetIndex }, createdAt, ... }`.
  On boot, populate from planet 0 players if absent.
- `token -> planet` decides every request:
  - `POST /api/join {tag, token}`: target = registry[token] if valid else 0; join core; return
    `{token, player, state, leaves, planetIndex, planetDepth, planetName}`. Persist registry.
  - `POST /api/action {token,type,label}`: click -> routed core.
  - new `POST /api/action {token, type:"escape"}`:
    1. verify mission: `missionProgress(player.oreCounts, missionForPlanet(index)).ready`, else
       `409 MISSION_INCOMPLETE`.
    2. nextIndex = index+1; ensure planet loaded (depth = planetDepth(nextIndex), fresh).
    3. create/adopt player in next planet preserving `tag`, `color`, `token`; carry `score`,
       reset `ores/oreValue/oreCounts/facesHeld`; old clone `online=false` (ghost stays on old
       planet). Update registry token->next; save registry.
    4. response `{ok:true, planetIndex, planetDepth, planetName, story, state, leaves, token}`.
    5. mark old planet clients for this token disconnected (client closes/reopens SSE); old SSE
       must not keep sending old-planet frames after registry update.
  - `GET /api/state|/api/world|/api/leaderboard?token=...`: route to that token's planet; without
    token -> planet 0. Always include `planetIndex`, `planetDepth`, `planetName` in state.
  - `GET /api/events?token=...`: snapshot from routed planet; room = planetIndex; broadcast cell/
    break/resource/toast/state/meteor **only to clients in that room**. `setOnline` on routed core.
- `world-core.js` additions:
  - `adoptPlayer({tag, token, color, score})` (or equivalent) to create a player in the target
    planet with the same token/color, no random reset; tag conflict -> suffix? (Should be free in
    a fresh scene; if conflict, use `TAG_2`).
  - `resetGrid({newSeed})`: rebuild base 20 tree for the planet's configured depth, clear
    ownership/faces/leaf map, keep players/score/ores, bump revision, persist; used by meteor.
  - Track hidden deposits: `hiddenDepositCount()` = active leaves with resourceId && !resourceFound.
  - `maybeMeteor()` / auto trigger when hidden count transitions >0 -> 0 after a click:
    assign a new planet seed (or same seed + new deposits), `resetGrid`, emit
    `{type:"meteor", planetIndex?, message:"METEOR IMPACT // PLANET RESET // NEW RESOURCES AVAILABLE"}`.
    Only trigger once until new deposits exist; do not trigger at boot with 0 deposits.
  - `getState()` adds `planetIndex`? (manager can inject) plus existing fields; manager decorates
    state with planetIndex/depth/name. Keep public player `oreCounts`.
- Meteor handling in manager: after routed click, if core.maybeMeteor() triggered, broadcast
  `meteor` + a fresh `snapshot` to that planet's room (clients reset tree).
- Infinite: planet indices unbounded; depths cap at 8; planets load on demand; no global reset.

### Tests (node:test)
- planetDepth 2/3; first-world migration resets grid depth2 and preserves players.
- token routing/rooms: two tokens on different planets don't see each other's clicks/state.
- escape: incomplete -> error; complete -> next planet depth 3, story valid/random, player carried
  color/tag/token, ore counts reset, score carried, registry updated; old planet player offline.
- meteor: finite depth2 planet has deposits; mine all (or force helper/method) then meteor event +
  fresh grid + new deposits + players preserved. No meteor at boot.
- SSE room isolation; `/api/state?token`; persistence of planets + registry across restart.
- Existing 63 tests green or updated for new routes (keep backward compatibility where possible).
Production 4173 is live — do NOT restart/kill it; use spare port + /tmp. Report API/routes/schema,
migration, tests, ETA. This is a large task; prioritize working planet routing/escape/meteor over
perfect edge cases.