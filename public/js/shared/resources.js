/**
 * NARIMATO — INFINITE GRID resource market.
 *
 * Story: humanity's seed ship has reached the rogue world MAGRATHEA, whose crust is
 * a geodesic lattice. Hidden inside its triangles are ore veins — some mundane
 * (silver, gold), some radioactive (uranium, palladium), some impossible
 * (Myrthil, Adamantium, Voidglass). A cell's deposit is random and hidden until
 * somebody mines it. Mining pays the discoverer its market value in credits
 * (score), and the deposit is marked on the cell forever.
 *
 * The catalog is shared by the server (authoritative hidden deposits + prices),
 * the renderer (discovered-ore markers/colours) and the UI (market legend).
 */

export const DEPOSIT_CHANCE = 0.3;

export const RESOURCES = Object.freeze([
  { id: 'silver', name: 'SILVER', glyph: 'Ag', value: 90, color: '#c9d6e5', weight: 26 },
  { id: 'gold', name: 'GOLD', glyph: 'Au', value: 180, color: '#ffd166', weight: 20 },
  { id: 'uranium', name: 'URANIUM', glyph: 'U', value: 420, color: '#7dff5c', weight: 10 },
  { id: 'palladium', name: 'PALLADIUM', glyph: 'Pd', value: 700, color: '#a9c7ff', weight: 6 },
  { id: 'iridium', name: 'IRIDIUM', glyph: 'Ir', value: 950, color: '#eceff6', weight: 4 },
  { id: 'voidglass', name: 'VOIDGLASS', glyph: 'Vg', value: 1200, color: '#b06bff', weight: 2.5 },
  { id: 'myrthil', name: 'MYRTHIL', glyph: 'My', value: 1600, color: '#5cffd0', weight: 1.6 },
  { id: 'aetherium', name: 'AETHERIUM', glyph: 'Ae', value: 2200, color: '#ff7ce5', weight: 1.0 },
  { id: 'adamantium', name: 'ADAMANTIUM', glyph: 'Ad', value: 3200, color: '#ff8c42', weight: 0.6 },
  { id: 'neutronium', name: 'NEUTRONIUM', glyph: 'Nt', value: 5000, color: '#f8f8ff', weight: 0.25 },
]);

const BY_ID = new Map(RESOURCES.map((resource) => [resource.id, resource]));
const TOTAL_WEIGHT = RESOURCES.reduce((sum, resource) => sum + resource.weight, 0);

export function resourceById(id) {
  return BY_ID.get(String(id)) || null;
}

/** Weighted random resource roll using a `random()` function returning [0,1). */
export function rollResource(random = Math.random) {
  const r = clamp01(Number(random())) * TOTAL_WEIGHT;
  let acc = 0;
  for (const resource of RESOURCES) {
    acc += resource.weight;
    if (r < acc) return resource;
  }
  return RESOURCES[RESOURCES.length - 1];
}

/**
 * Decide whether a newly created cell hides a deposit, and which one.
 * @returns {Object|null} resource catalog entry or null for an empty cell.
 */
export function rollDeposit(random = Math.random) {
  if (clamp01(Number(random())) >= DEPOSIT_CHANCE) return null;
  return rollResource(random);
}

/** Public-market wire shape (prices are public; deposit locations are not). */
export function publicResource(resource) {
  if (!resource) return null;
  return {
    id: resource.id,
    name: resource.name,
    glyph: resource.glyph,
    value: resource.value,
    color: resource.color,
  };
}

export const RESOURCE_MARKET = Object.freeze(RESOURCES.map(publicResource));

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 0.999999999 : value;
}
