
export const COPY_DEFAULTS = Object.freeze({
  breakClicks: 4,
  deeperClicks: 8,
  planetName: 'MAGRATHEA',
  planetSource: "HITCHHIKER'S GUIDE",
  planetLevels: 2,
  count: 0,
  material: 'Uranium',
});

export const MISSION_LABELS = Object.freeze({
  fuel: 'FUEL RODS',
  hull: 'HULL PLATES',
  warp: 'WARP CORE',
});

export function plural(name, count) {
  const word = String(name == null ? '' : name).trim();
  if (!word) return word;
  if (Number(count) === 1) return word;
  if (/(?:s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

const MASS_NOUN_OVERRIDES = new Set(['silver', 'gold', 'uranium', 'palladium', 'iridium',
  'voidglass', 'myrthil', 'aetherium', 'adamantium', 'neutronium']);

export function materialName(name) {
  return String(name == null ? '' : name)
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_match, space, letter) => `${space}${letter.toUpperCase()}`);
}

export function materialQuantity(name, count) {
  const key = String(name == null ? '' : name).trim().toLowerCase();
  const n = Number.isFinite(Number(count)) ? Math.max(0, Math.trunc(Number(count))) : 0;
  const label = MASS_NOUN_OVERRIDES.has(key) ? materialName(name) : plural(materialName(name), n);
  return `${n} ${label}`;
}

export function joinList(items) {
  const parts = (Array.isArray(items) ? items : []).map((item) => String(item).trim()).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function clicksWord(count) {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const n = Math.trunc(Number(count));
  return Number.isFinite(n) && n >= 0 && n < words.length ? words[n] : String(n);
}

export function breakClicksFor(planetIndex, baseBreakClicks = COPY_DEFAULTS.deeperClicks) {
  const base = Math.max(1, Math.trunc(Number(baseBreakClicks)) || COPY_DEFAULTS.deeperClicks);
  const index = Math.max(0, Math.trunc(Number(planetIndex)) || 0);
  return index === 0 ? Math.min(base, 4) : base;
}

export function guideThresholdSentence(breakClicks) {
  const clicks = Math.max(1, Math.trunc(Number(breakClicks)) || COPY_DEFAULTS.breakClicks);
  return `${clicksWord(clicks)} clicks break it into four smaller cells.`;
}

export const GUIDE_STEPS = Object.freeze([
  {
    id: 'what',
    title: 'WHAT TO MINE',
    cueId: 'guide-what',
    body: () => 'The *THE WAY HOME* panel lists every part the ship still needs. Rare parts are marked *RARE*.',
  },
  {
    id: 'how',
    title: 'HOW TO MINE',
    cueId: 'guide-how',
    body: (ctx = {}) =>
      `Click or tap a triangle to charge it. ${clicksWord(ctx.breakClicks)} clicks break it into four smaller cells; ` +
      `deeper worlds ask for ${clicksWord(ctx.deeperClicks).toLowerCase()}.`,
  },
  {
    id: 'where',
    title: 'WHERE TO DIG',
    cueId: 'guide-where',
    body: () =>
      'Ore is hidden and appears on a random click. Follow the gold *NAV* beacon to the best nearby ground; ' +
      '*WHAT WE’RE CARRYING* shows your spare ore.',
  },
  {
    id: 'leave',
    title: 'HOW TO LEAVE',
    cueId: 'guide-leave',
    body: () =>
      'When every system says *LOADED*, the central *TRY TO FLY AWAY* button opens. Take it and the next world is yours.',
  },
]);

export function guideStepBody(id, context = {}) {
  const ctx = copyContext(context);
  const step = GUIDE_STEPS.find((entry) => entry.id === id);
  return step ? step.body(ctx) : '';
}

export const HELP_SECTIONS = Object.freeze([
  {
    id: 'story',
    voiceId: 'help-story',
    title: 'THE WAY BACK',
    body: [
      'You are a pilot thrown through a wormhole to the far side of the universe. Your ship is trapped above a rogue geodesic planet with empty tanks.',
      'Mine the crust, rebuild the drive, escape, and follow the worlds toward home. Every planet is deeper, stranger and more contested.',
    ],
  },
  {
    id: 'mining',
    voiceId: 'help-mining',
    title: 'MINING & CHARGE',
    body: [
      'Click or tap a triangle to claim or charge it. At the planet threshold it breaks into four smaller spherical cells.',
      'Ore is hidden and is found on a random successful click — first, middle or the breaking click. Green cells can be mined; red cells are locked to you.',
    ],
  },
  {
    id: 'lock',
    voiceId: 'help-lock',
    title: 'CONTEST LOCK & ROBOTS',
    body: [
      'You cannot re-click your own cell until another player or robot contests it. Red means you are locked out; it clears when someone else clicks.',
      'Every planet is staffed to keep at least three players: one human gets two robots, two humans get one, three or more play bot-free.',
    ],
  },
  {
    id: 'planets',
    voiceId: 'help-planets',
    title: 'PLANETS & ESCAPE',
    body: [
      'Planet 1 is 2 levels (20 + 80 cells), planet 2 is 3 levels (20 + 80 + 320), and deeper planets follow.',
      'Complete the refit to unlock ESCAPE. Your ore inventory travels with you and counts toward the next planet. Fully mined planets are reseeded by a meteor.',
    ],
  },
  {
    id: 'navigation',
    voiceId: 'help-navigation',
    title: 'NAVIGATION & CAMERA',
    body: [
      'The gold NAV beacon and chip point to a strong nearby cell by biome and ore chance. Tap the chip to fly there, or the arrow to cycle.',
      'Drag and release to let the planet glide. Scroll or pinch to zoom smoothly. Double-click a cell to focus it.',
    ],
  },
  {
    id: 'controls',
    voiceId: 'help-controls',
    title: 'CONTROLS & AUDIO',
    body: [
      'Click: mine. Drag: rotate the planet (release to glide). Arrow keys: travel around the planet. Shift: faster travel. Mouse drag and cursor travel are separate. I: reverse drag. L: cell ids.',
      'CC toggles subtitles. The voice button toggles narration. Both remember your choice and are independent, like a streaming player.',
    ],
  },
]);

export const INCIDENT_COPY = Object.freeze([
  {
    kind: 'meteor',
    title: 'METEOR IMPACT',
    tone: 'fire',
    message: 'A METEOR SHATTERED THE OLD CRUST // NEW RESOURCES AVAILABLE',
    description:
      'A rogue meteor punched through the surface. The old tunnels are gone, but the crater cracked open fresh ore veins and threw rare material across the ground. Get down there and salvage what the rock is hiding.',
  },
  {
    kind: 'nuclear',
    title: 'NUCLEAR WAR',
    tone: 'nuclear',
    message: 'NUCLEAR WAR SCORCHED THE SURFACE // NEW RESOURCES EXPOSED',
    description:
      'Atomic fire swept the planet from horizon to horizon. The blast waves split the crust and exposed new materials. The survivors are already picking through the rubble.',
  },
  {
    kind: 'solar',
    title: 'SOLAR FLARE',
    tone: 'solar',
    message: 'A SOLAR FLARE PEELED BACK THE CRUST // CRUST RESEEDED',
    description:
      'The local star lashed out and cooked the daylight side. The magnetic storm peeled back rock and scattered rare elements across the new ground. The ore is close.',
  },
  {
    kind: 'alien',
    title: 'ALIEN INVASION',
    tone: 'alien',
    message: 'ALIENS DEMOLISHED THE SURFACE // NEW RESOURCES AND MATERIALS',
    description:
      'An alien fleet razed the planet from orbit. Their beams demolished the old surface and scattered new materials across the wreckage. Whatever they wanted, they left plenty behind for us.',
  },
]);

export const GENERIC_CATASTROPHE = Object.freeze({
  kind: 'meteor',
  title: 'CATASTROPHE',
  tone: 'fire',
  message: 'THE PLANET WAS EXHAUSTED // NEW RESOURCES AVAILABLE',
  description:
    'The crust tore itself apart. The old tunnels are gone, but the upheaval scattered fresh ore across the surface. Get down there and salvage what the rock is hiding.',
});

export function incidentCopy(kind) {
  const key = String(kind == null ? '' : kind).toLowerCase();
  return INCIDENT_COPY.find((entry) => entry.kind === key) || GENERIC_CATASTROPHE;
}

export function captainLog({ planetName = COPY_DEFAULTS.planetName, planetSource = '', missing = [], ready = false } = {}) {
  if (ready) {
    return `The drive is breathing again. We can leave ${planetName} whenever you're ready — but the next world will ask for more.`;
  }
  const counts = (Array.isArray(missing) ? missing : [])
    .map((item) => ({ left: Math.max(0, Math.trunc(Number(item && item.left)) || 0), name: item && item.name }))
    .filter((item) => item.left > 0 && item.name);
  if (!counts.length) {
    return `We're still on ${planetName}. The drive is almost there. Check the ship, then take us home.`;
  }
  const needs = joinList(counts.map((item) => materialQuantity(item.name, item.left)));
  const where = planetSource ? ` — ${planetSource}` : '';
  return `We're grounded on ${planetName}${where}. The drive still needs ${needs}. The crust can give it to us.`;
}

export const EMPTY_STATES = Object.freeze({
  log: "We're still on {planet}. The drive is almost there. Check the ship, then take us home.",
  cargo: 'Nothing in the hold yet. Mine a triangle to start the refit.',
});

export function copyContext(context = {}) {
  const source = context && typeof context === 'object' ? context : {};
  return {
    ...COPY_DEFAULTS,
    ...source,
    breakClicks: Math.max(1, Math.trunc(Number(source.breakClicks ?? COPY_DEFAULTS.breakClicks)) || COPY_DEFAULTS.breakClicks),
    deeperClicks: Math.max(1, Math.trunc(Number(source.deeperClicks ?? COPY_DEFAULTS.deeperClicks)) || COPY_DEFAULTS.deeperClicks),
    planetLevels: Math.max(1, Math.trunc(Number(source.planetLevels ?? COPY_DEFAULTS.planetLevels)) || COPY_DEFAULTS.planetLevels),
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderInlineHtml(text) {
  return escapeHtml(text).replace(/\*([^*<>]+)\*/g, '<em>$1</em>');
}

export function renderInlineMarkdown(text) {
  return String(text);
}

function guideStepHtml(step, ctx) {
  const spanId = step.id === 'how' ? ' id="guide-how-copy"' : '';
  return [
    '<li>',
    `  <b>${escapeHtml(step.title)}</b>`,
    `  <span${spanId}>${renderInlineHtml(step.body(ctx))}</span>`,
    '</li>',
  ].join('\n');
}

function incidentMarkdownLines() {
  return INCIDENT_COPY.map(
    (incident) => `- **${incident.title}** — ${incident.description}`
  ).join('\n');
}

export function docBlocks(context = {}) {
  const ctx = copyContext(context);
  const planetOne = breakClicksFor(0, ctx.deeperClicks);
  return [
    {
      id: 'guide-mining',
      file: 'GUIDE.md',
      format: 'markdown',
      content:
        `Each planet has **one break threshold**: the first world breaks a triangle at **${planetOne} clicks**; deeper worlds ask for **${ctx.deeperClicks}**. ` +
        'Reach the threshold and that triangle splits into four smaller cells; the children start charging from zero.', 
    },
    {
      id: 'guide-relief',
      file: 'GUIDE.md',
      format: 'markdown',
      content:
        'If you make no refit progress for **two minutes**, a relief ship crashes onto the planet and scatters the missing ore across marked triangles. It repeats every two minutes while parts are still missing.',
    },
    {
      id: 'guide-rare',
      file: 'GUIDE.md',
      format: 'markdown',
      content: [
        '- Planet 1: exactly **one** rare unit.',
        '- Planet 2: exactly **one** rare unit.',
        '- Planet 3: up to **two** rare units.',
        '- Planet 4: up to **three** rare units.',
        '- Deeper worlds can demand more rare material.',
      ].join('\n'),
    },
    {
      id: 'guide-steps',
      file: 'public/index.html',
      format: 'html',
      content: GUIDE_STEPS.map((step) => guideStepHtml(step, ctx)).join('\n'),
    },
    {
      id: 'gameplay-mining',
      file: 'GAMEPLAY.md',
      format: 'markdown',
      content:
        `Each planet has **one break threshold**: **${planetOne} clicks** on the first world, **${ctx.deeperClicks}** on deeper worlds. At the threshold, that single triangle breaks into four smaller spherical triangles; children inherit the owner and start charging from 0.`,
    },
    {
      id: 'gameplay-relief',
      file: 'GAMEPLAY.md',
      format: 'markdown',
      content:
        'If the refit makes no progress for two minutes, a relief ship crashes onto the planet and scatters the missing ore across nearby triangles. The deposits are marked with salvage rings and are mineable on the first successful click. The drop is **planet-wide**: the server places every human at the impact footprint on a distinct safe standing point inside a marked cell, every client sees the marked cells, the view turns toward the impact, and anyone can harvest the ore — it is a race. A pilot who joins while the drop is still live arrives already focused. Another ship can arrive after each two-minute window while parts are missing.',
    },
    {
      id: 'gameplay-incidents',
      file: 'GAMEPLAY.md',
      format: 'markdown',
      content: incidentMarkdownLines(),
    },
    {
      id: 'gameplay-quick-guide',
      file: 'GAMEPLAY.md',
      format: 'markdown',
      content:
        'The first landing offers a one-screen answer to **what to mine**, **how to mine**, **where to dig** and **how to leave**; the same card is behind **GUIDE** and at `?guide=1` for sharing.',
    },
    {
      id: 'gameplay-rare',
      file: 'GAMEPLAY.md',
      format: 'markdown',
      content:
        'Every refit includes at least one rare material; look for the **RARE** marker. Early planets are deliberately gentle: planets 1–2 need exactly one rare unit, planet 3 up to two, planet 4 up to three, then the deeper worlds ramp up.',
    },
    {
      id: 'gameplay-captain-log',
      file: 'GAMEPLAY.md',
      format: 'markdown',
      content:
        `The log tells you in plain language what the ship still needs, for example "${captainLog({ planetName: 'TATOOINE', planetSource: 'STAR WARS', missing: [{ name: 'uranium', left: 2 }, { name: 'palladium', left: 1 }] })}"`,
    },
  ];
}
