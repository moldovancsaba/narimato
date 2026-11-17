# NARIMATO — RESOURCES / MINING LAYER (v3 addendum)

Story: humanity's seed ship reaches **ICOSA-9**, a rogue geodesic planet. Its crust is a lattice
of triangle cells; hidden inside are ore veins and impossible materials. Operators mine the
hidden deposits, contest the grid, and sell finds into the frontier market.

## Shared catalog — `public/js/shared/resources.js` (Lead-owned, frozen)

10 resources, price in credits = score value, weighted rarity, neon colour/glyph:

| id | name | glyph | price | weight |
|---|---|---|---|---|
| silver | SILVER | Ag | 90 | 26 |
| gold | GOLD | Au | 180 | 20 |
| uranium | URANIUM | U | 420 | 10 |
| palladium | PALLADIUM | Pd | 700 | 6 |
| iridium | IRIDIUM | Ir | 950 | 4 |
| voidglass | VOIDGLASS | Vg | 1200 | 2.5 |
| myrthil | MYRTHIL | My | 1600 | 1.6 |
| aetherium | AETHERIUM | Ae | 2200 | 1.0 |
| adamantium | ADAMANTIUM | Ad | 3200 | 0.6 |
| neutronium | NEUTRONIUM | Nt | 5000 | 0.25 |

Exports: `RESOURCES`, `RESOURCE_MARKET` (public wire: id/name/glyph/value/color, no weights),
`resourceById`, `rollResource(random)`, `rollDeposit(random)`, `DEPOSIT_CHANCE = 0.3`.

## Hidden deposits / mining

- Every cell created (20 base cells and every new child on a break) independently rolls a hidden
  deposit (30% chance; catalog weighted). Hidden deposits are **server-only** — never sent to
  clients before discovery.
- A successful click on a cell with an undiscovered deposit instantly **mines** it: the clicker
  gets `+value` credits (added to score), the cell's deposit is marked discovered forever and
  records the finder. No extra click needed. Rejected clicks (cooldown/lock) mine nothing.
- Discovered deposits are visible to everyone as a small resource marker on the cell; hidden cells
  look identical to empty cells.
- Breaks generate fresh hidden deposits for all four children.
- Bots mine exactly like players.
- Players accumulate `ores` (count) and `oreValue` (credits) across the persistent world; the
  session report also shows this session's ores/value and best find.

## Protocol additions

`Leaf = [label, ownerIndex, clicks, discoveredResourceId|null]` — the 4th slot is only filled once
a deposit is discovered; hidden deposits are never leaked. All existing fields unchanged.

`State` adds:
```js
resources: RESOURCE_MARKET,     // public catalog/prices
// each player adds: ores, oreValue
```
`POST /api/action` click response adds (when a deposit was mined):
```js
resource: { id, name, glyph, value, color }
```
New SSE frame (immediately on discovery):
```js
{ type:"resource", label, resource:{id,name,glyph,value,color}, playerId, points }
```
New config/env: `DEPOSIT_CHANCE` (0..1, default 0.3) for testing/play tuning.
Tests need injectable RNG (world-core already has one) and a way to force deposits.

## Client

- `public/js/world.js`: store `resourceId` from Leaf[3]; handle break child entries with 4th slot;
  `applyResource(label, resourceId)`.
- `app.js`: apply `resource` frames/action responses; toast/floating text for discoveries;
  session `ores/oreValue/bestFind`; report payload fields `{ores, oreValue, bestFind:{id,name,glyph,value,color}}`;
  hover info includes resource.
- `renderer.js`: import `resourceById`; faces carry `resourceId`; draw a small discovered-deposit
  marker (diamond + glyph in resource colour) at the centroid (no clutter; skip for tiny cells),
  support `pulse(label,{kind:'resource',color,text})`, and `discoverResource(label,resourceId)` for
  an instant marker + burst. Hidden cells get no marker.
- UI: landing gets the **story block** ("YEAR 2189 // SEED SHIP …") and a **RESOURCE MARKET**
  legend with names/prices/colours; session report gets `ORES MINED`, `ORE VALUE`, `RICHEST FIND`;
  1200×630 card shows the same. Toast pattern for discoveries.
