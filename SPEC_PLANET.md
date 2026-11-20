# NARIMATO — PLANET SURFACE / TERRAIN LAYER (v4 addendum)

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [RND-02](https://github.com/moldovancsaba/narimato/issues/15) · [RND-04](https://github.com/moldovancsaba/narimato/issues/17)
<!-- delivery-ssot:end -->

Research summary lives in `PLANET_RESEARCH.md`; implementation is
`public/js/shared/planet.js` (Lead-owned, frozen for this pass).

## Model

- ONE 32-bit `planetSeed` per world (persisted; exposed in state). No textures, no heightmaps,
  no per-vertex asset data: terrain is derived from seeded 3D value-noise sampled at the unit
  direction of each cell centroid, so client and server compute identical worlds.
- `terrainAt(seed, centroid)` → `{ elevation, temperature, moisture, latitude, longitude, biome }`.
  - Domain-warped 3D fBm continents + ridged noise mountains; `SEA_LEVEL = 0.1`.
  - Climate: equator→pole temperature gradient, elevation lapse rate, moisture fBm.
  - Biomes: `deep_ocean`, `ocean`, `coast`, `plains`, `forest`, `desert`, `hills`, `mountain`,
    `peak`, `ice`. Both poles are ice caps. Observed distribution: ~34% ocean/sea ice,
    ~16% ice, ~6% plains/desert/forest lowlands, ~33% hills/mountains/peaks, ~7% coast.
- Surface mining only on **mineable** biomes. `deep_ocean`/`ocean` cells have no surface
  deposits at all: resources there would be under kilometres of water and cannot be mined from
  the top layer. Coast is shallow-water placer ground (gold/silver/palladium).
- Deposit chance and resource weights are geological:
  - coast 18% placer; plains 25%; forest 20%; desert 24%; hills 36%; mountain 44%; peak 50%;
    ice 16%.
  - mountains favour gold/silver/palladium/iridium/myrthil/adamantium/uranium;
    peaks favour iridium/myrthil/aetherium/adamantium/neutronium; ice favours iridium/aetherium/
    neutronium; desert gold/voidglass/aetherium; plains/forest silver/uranium/voidglass etc.
- `rollTerrainDeposit(terrain, random)` implements this; `DEPOSIT_CHANCE` env, when explicitly
  set, overrides the biome chance for **mineable** cells only (0/1 testing).

## Server changes (`lib/world-core.js`, tests)

- Generate/persist `planetSeed` (random uint32) and `terrainVersion = PLANET_VERSION`.
- Fresh cells/break children: compute terrain, then `rollTerrainDeposit`; ocean cells never get
  surface deposits. Persist planet seed + version.
- **Migration of existing world**: if no planetSeed/terrainVersion, assign one and re-roll
  *undiscovered* deposits for all active leaves from terrain (found deposits stay; ocean hidden
  deposits are removed). Persist. Players/scores/ores untouched.
- State adds `planetSeed` and `terrainVersion`; `/api/state`, `/api/world` carry them.
- **Leaf wire grows a 5th slot: `[label, ownerIndex, clicks, discoveredResourceId|null, lastClickIndex]`**
  so clients can know the own-cell contest lock without guessing. `lastClickIndex` is a player
  index or -1. Action/cell/break payload leaf tuples use the same 5 slots. This powers the client
  anti-spam fix (stop rendering `+2` when a click is locked).
- Tests: seed persistence & migration, biome-appropriate deposit sets (ocean never), env override,
  found deposits preserved, 5-tuple wire, existing suites updated.

## Renderer (`public/js/renderer.js`)

- Faces carry `terrain: { biome, elevation, temperature, color, mineable }` computed by the app.
- Draw the planet surface as biome colour underlay: deep ocean/ocean blue, coast teal,
  plains/forest green, desert ochre, hills/mountains rock, peaks/ice caps bright. Owner colour
  remains an overlay/claim tint; neon edges stay. Ocean cells read clearly as water; ice caps
  bright at poles; hills/mountains shaded by elevation. Hidden deposits still have no marker.
- Avoid turning the game into a flat planet painting: keep the holographic/neon identity,
  depth sorting, ownership visibility and 60fps.

## Client (`public/js/world.js`, `public/js/app.js`)

- World stores `planetSeed`; `terrainFor(node)` computes & caches `terrainAt(planetSeed, centroid)`.
- Faces sent to renderer include terrain; hover info includes terrain summary and `mineable`
  ("SUBMERGED // NO SURFACE DEPOSITS" for ocean).
- **+2 spam fix:** before any optimistic click/pulse, if the cell is mine (ownerIndex===myIndex)
  and `lastClickIndex===myIndex`, do not send, do not pulse, do not animate points; show a
  rate-limited toast "CELL LOCKED // ANOTHER OPERATOR MUST CONTEST IT FIRST". Server remains
  authoritative. Update `lastClickIndex` from snapshots/cell/break events and optimistic clicks.
- Terrain only derived on client; no new network payloads except seed + 5th lock slot.

## UI (`public/index.html`, CSS, `ui.js`)

- Hovered-cell inspector adds a `TERRAIN` line (biome name + elevation) and a lock/submerged
  status: `LOCKED // CONTEST REQUIRED` for own locked cells, `SUBMERGED // NO SURFACE DEPOSITS`
  for ocean/deep ocean. Use terrain colour accent. Keep existing layout/API; add `setHoverFace`
  support for `terrain`/`locked` fields (no breaking changes).

## QA

- New `test/planet.test.js`: deterministic sampling, seed variation, both poles ice, biome set,
  ocean non-mineable, terrain deposit never in ocean, weighted resource ids valid, same function
  called twice gives same result (client/server parity).
- Server/E2E: planetSeed in state; old world migrates; ocean cells cannot mine; land cells can;
  hover shows terrain; locked own cell does not spam +2 and server rejects; world persists.
