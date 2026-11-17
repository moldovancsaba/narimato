/**
 * NARIMATO — multi-planet manager.
 *
 * Owns one authoritative `WorldCore` per planet:
 *   - planet 0        = DATA_DIR/world.json            (migrated from the single-world build)
 *   - planet i (i>0)  = DATA_DIR/planets/p<i>/world.json
 * plus `DATA_DIR/planets/registry.json` ({ tokens: { token: planetIndex } }).
 *
 * Planet depth/name/mission rules come from the frozen shared
 * `public/js/shared/mission.js`, so client and server agree.
 *
 * The manager is also the escape/meteor game-master: it validates the escape
 * mission against the pilot's persisted ore inventory, adopts the pilot onto the
 * next planet (keeping tag/colour/token + carried score, resetting the ore run)
 * and flags meteor resets when a planet's hidden deposits are exhausted.
 *
 * Zero npm dependencies, ESM, Node >= 20.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { WorldCore } from './world-core.js';
import { planetDepth, planetName, missionForPlanet, missionProgress } from '../public/js/shared/mission.js';

export const REGISTRY_VERSION = 1;
const PLANETS_DIR = 'planets';

/** Random interplanetary escape stories (client renders whatever is returned). */
export const ESCAPE_STORIES = Object.freeze([
  {
    id: 'space-storm',
    title: 'SPACE STORM',
    tone: 'danger',
    lines: [
      'The drive lights and the planet falls away.',
      'Ion clouds tear at the hull; every warning light speaks at once.',
      'You ride the storm out — battered, but alive.',
    ],
  },
  {
    id: 'gravity-slingshot',
    title: 'GRAVITY SLINGSHOT',
    tone: 'awe',
    lines: [
      'No fuel to spare, so you aim for the giant instead.',
      'The planet whips you around and flings you deeper into the dark.',
      'Somewhere ahead, a new geodesic world waits.',
    ],
  },
  {
    id: 'pirate-ambush',
    title: 'PIRATE AMBUSH',
    tone: 'danger',
    lines: [
      'Raiders drop out of the shadow of the moon.',
      'You burn hard, scatter their volley, and lose them in the debris belt.',
      'The next planet swallows your trail.',
    ],
  },
  {
    id: 'wormhole-tremor',
    title: 'WORMHOLE TREMOR',
    tone: 'mystery',
    lines: [
      'The warp core shudders and reality folds inward.',
      'For eleven seconds the stars are on the wrong side of the canopy.',
      'You emerge with new coordinates burned into the nav board.',
    ],
  },
  {
    id: 'derelict-beacon',
    title: 'DERELICT BEACON',
    tone: 'mystery',
    lines: [
      'A dead ship hails you in a language nobody has spoken for a century.',
      'You copy its charts and leave a marker for the next pilot.',
      'Ahead: another frontier world, still unclaimed.',
    ],
  },
  {
    id: 'magnetic-riptide',
    title: 'MAGNETIC RIPTIDE',
    tone: 'awe',
    lines: [
      'The escape vector cuts straight through the planet\'s magnetic tail.',
      'Plasma sheets shimmer across the cockpit glass.',
      'You surf the current out of the gravity well.',
    ],
  },
  {
    id: 'comet-drift',
    title: 'COMET DRIFT',
    tone: 'wonder',
    lines: [
      'A comet crosses your burn path, shedding ice and dust.',
      'You skim its tail for extra ions, then let it fall behind.',
      'The next world glints in the distance.',
    ],
  },
  {
    id: 'reactor-surge',
    title: 'REACTOR SURGE',
    tone: 'danger',
    lines: [
      'The rebuilt drive surges past its rated limit.',
      'You cut the feed at the last second; the hull rings like a bell.',
      'Nine atmospheres of silence, and then a new planet below.',
    ],
  },
  {
    id: 'quiet-drift',
    title: 'QUIET DRIFT',
    tone: 'calm',
    lines: [
      'Nothing follows you out of the gravity well. No sirens, no alarms.',
      'Just the low hum of the drive and a sky full of ore-bright worlds.',
      'You pick one and start the descent.',
    ],
  },
]);

async function readJsonSafe(file) {
  try {
    const text = await fsp.readFile(file, 'utf8');
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function atomicWriteJson(file, data) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  try {
    await fsp.rename(tmp, file);
  } catch (err) {
    if (err && (err.code === 'EEXIST' || err.code === 'EPERM')) {
      await fsp.rm(file, { force: true });
      await fsp.rename(tmp, file);
    } else {
      await fsp.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }
}

const fail = (error, message, extra = {}) => ({ ok: false, error, message, ...extra });

export class PlanetManager {
  constructor({ dataDir, config, now = Date.now, rng = Math.random, quiet = false, autoSave = true } = {}) {
    if (!dataDir) throw new TypeError('PlanetManager requires a dataDir');
    this.baseDataDir = dataDir;
    this.config = config;
    this.now = typeof now === 'function' ? now : Date.now;
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this.quiet = !!quiet;
    this.autoSave = autoSave !== false;
    this.startedAt = this.now();

    /** @type {Map<number, WorldCore>} */
    this.cores = new Map();
    this.registry = { version: REGISTRY_VERSION, createdAt: this.now(), tokens: {} };
    this.registryPath = path.join(this.baseDataDir, PLANETS_DIR, 'registry.json');
    this._registryChain = Promise.resolve();
    this.log = (...args) => {
      if (!this.quiet) console.warn('[planet-manager]', ...args);
    };
  }

  static async open(options = {}) {
    const manager = new PlanetManager(options);
    await manager.init();
    return manager;
  }

  planetDir(index) {
    return index === 0 ? this.baseDataDir : path.join(this.baseDataDir, PLANETS_DIR, `p${index}`);
  }

  configForPlanet(index) {
    // `planetDepth(i)` is the number of visible levels (planet 0 = 2 levels:
    // the 20 base faces + 80 first-generation children). The break cap is one
    // less than that: depth 0 is the base level.
    const levels = planetDepth(index);
    return {
      ...this.config,
      dataDir: this.planetDir(index),
      maxDepth: Math.max(0, levels - 1),
      // The first planet is the tutorial: breaks are faster so a solo pilot +
      // the robot can actually teach the loop. Later planets use the normal
      // threshold.
      breakClicks: index === 0 ? Math.min(this.config.breakClicks, 4) : this.config.breakClicks,
    };
  }

  depth(index) {
    return planetDepth(index);
  }

  name(index) {
    return planetName(index);
  }

  /** First boot: migrate the single-world file into planet 0 + registry. */
  async init() {
    await fsp.mkdir(path.join(this.baseDataDir, PLANETS_DIR), { recursive: true });
    const stored = await readJsonSafe(this.registryPath);
    const hasRegistry = !!stored && typeof stored === 'object' && stored.tokens && typeof stored.tokens === 'object';

    const planet0 = await this.ensurePlanet(0);
    if (!hasRegistry) {
      // Migration: keep every pilot, but the first planet is a fresh depth-2
      // grid (the old single-world tree may be arbitrarily deep).
      planet0.resetGrid({ mission: missionForPlanet(0) });
      planet0.ensureMissionDeposits(missionForPlanet(0));
      const tokens = {};
      for (const player of planet0.players) tokens[player.token] = 0;
      this.registry = { version: REGISTRY_VERSION, createdAt: this.now(), tokens };
      await planet0.flush();
      await this.saveRegistry();
      this.log('migrated existing world into planet 0 (grid reset to depth 2, players preserved)');
    } else {
      this.registry = {
        version: REGISTRY_VERSION,
        createdAt: Number.isFinite(stored.createdAt) ? stored.createdAt : this.now(),
        tokens: { ...stored.tokens },
      };
      let changed = false;
      for (const player of planet0.players) {
        if (!Number.isInteger(this.registry.tokens[player.token])) {
          this.registry.tokens[player.token] = 0;
          changed = true;
        }
      }
      if (changed) await this.saveRegistry();
    }
    return this;
  }

  async ensurePlanet(index) {
    const i = Number.isInteger(index) && index >= 0 ? index : 0;
    const existing = this.cores.get(i);
    if (existing) return existing;
    const core = await WorldCore.open({
      dataDir: this.planetDir(i),
      config: this.configForPlanet(i),
      now: this.now,
      rng: this.rng,
      autoSave: this.autoSave,
      quiet: this.quiet,
    });
    // A brand-new planet must be able to satisfy its refit.
    if (core.freshlyCreated) core.ensureMissionDeposits(missionForPlanet(i));
    // If an older world contains cells deeper than this planet's configured
    // level cap (e.g. the pre-3.0 deep first planet), rebuild just the grid.
    let rebuilt = false;
    if (core._treeDepth() > core.config.maxDepth) {
      core.resetGrid({ mission: missionForPlanet(i) });
      rebuilt = true;
      this.log(`planet ${i}: reset grid to ${planetDepth(i)} levels (${core.config.maxDepth} break cap)`);
    }
    // A fully mined planet with no hidden deposits left must be reseeded. This
    // also repairs worlds saved before meteor arming was refreshed after the
    // guaranteed mission deposits were added.
    if (
      !rebuilt &&
      core.config.depositChance !== 0 &&
      core.hiddenDepositCount() === 0 &&
      core.totalClicks > 0
    ) {
      core.resetGrid({ mission: missionForPlanet(i) });
      rebuilt = true;
      this.log(`planet ${i}: reseeded depleted grid (meteor recovery)`);
    }
    if (rebuilt) await core.flush();
    this.cores.set(i, core);
    return core;
  }

  planetCore(index) {
    return this.cores.get(index) || null;
  }

  loadedPlanets() {
    return [...this.cores.entries()].sort((a, b) => a[0] - b[0]).map(([index, core]) => ({ index, core }));
  }

  planetIndexForToken(token) {
    if (typeof token !== 'string') return 0;
    const index = this.registry.tokens[token];
    return Number.isInteger(index) && index >= 0 ? index : 0;
  }

  async coreForToken(token) {
    const index = this.planetIndexForToken(token);
    const core = await this.ensurePlanet(index);
    return { index, core };
  }

  decorateState(state, index) {
    const levels = planetDepth(index);
    return { ...state, planetIndex: index, planetDepth: levels, planetLevels: levels, planetName: planetName(index) };
  }

  decorateJoin(result, index) {
    return {
      ...result,
      planetIndex: index,
      planetDepth: planetDepth(index),
      planetLevels: planetDepth(index),
      planetName: planetName(index),
      state: this.decorateState(result.state, index),
    };
  }

  async saveRegistry() {
    const payload = { ...this.registry };
    this._registryChain = this._registryChain
      .catch(() => {})
      .then(() => atomicWriteJson(this.registryPath, payload))
      .catch((err) => this.log('registry save failed:', err?.message || err));
    return this._registryChain;
  }

  // -------------------------------------------------------------------- join

  async join({ tag, token } = {}) {
    const { index, core } = await this.coreForToken(token);
    const result = core.join({ tag, token });
    if (!result.ok) return result;
    if (this.registry.tokens[result.token] !== index) {
      this.registry.tokens[result.token] = index;
      await this.saveRegistry();
    }
    return this.decorateJoin(result, index);
  }

  // ------------------------------------------------------------------ clicks

  /** Route a click; returns the core result + optional meteor payload. */
  async click({ token, label } = {}) {
    const { index, core } = await this.coreForToken(token);
    const result = core.click({ token, label });
    if (!result.ok) return { index, core, result, meteor: null };
    const meteor = core.maybeMeteor();
    if (meteor) core.ensureMissionDeposits(missionForPlanet(index));
    return { index, core, result, meteor };
  }

  // ------------------------------------------------------------------ escape

  randomStory() {
    const index = Math.min(ESCAPE_STORIES.length - 1, Math.floor(this.rng() * ESCAPE_STORIES.length));
    const story = ESCAPE_STORIES[index];
    return { id: story.id, title: story.title, tone: story.tone, lines: [...story.lines] };
  }

  async escape({ token } = {}) {
    const { index, core } = await this.coreForToken(token);
    const player = core.findByToken(token);
    if (!player) return fail('NOT_JOINED', 'Join with a valid token before escaping.');
    const mission = missionForPlanet(index);
    const progress = missionProgress(player.oreCounts || {}, mission);
    if (!progress.ready) {
      return fail('MISSION_INCOMPLETE', 'The escape drive needs more ore.', { mission: progress });
    }
    const nextIndex = index + 1;
    const nextCore = await this.ensurePlanet(nextIndex);
    const adopted = nextCore.adoptPlayer({
      tag: player.tag,
      token: player.token,
      color: player.color,
      score: player.score,
      id: player.id,
    });
    // Old clone becomes a permanent offline ghost on the planet we left.
    core.setOnline(player.id, false);
    this.registry.tokens[player.token] = nextIndex;
    await this.saveRegistry();
    return {
      ok: true,
      token: adopted.token,
      player: adopted.player, // compact identity for the client
      oldPlanetIndex: index,
      planetIndex: nextIndex,
      planetDepth: planetDepth(nextIndex),
      planetLevels: planetDepth(nextIndex),
      planetName: planetName(nextIndex),
      story: this.randomStory(),
      state: this.decorateState(adopted.state, nextIndex),
      leaves: adopted.leaves,
    };
  }

  // ------------------------------------------------------------ planet views

  async routedView(token, kind = 'state') {
    const { index, core } = await this.coreForToken(token);
    const state = this.decorateState(core.getState(), index);
    if (kind === 'world') return { index, core, state, leaves: core.getLeaves() };
    if (kind === 'leaderboard') return { index, core, state, leaderboard: core.getLeaderboard(20) };
    return { index, core, state };
  }

  health() {
    let playersOnline = 0;
    let faces = 0;
    let maxDepthReached = 0;
    let totalClicks = 0;
    for (const { core } of this.loadedPlanets()) {
      const health = core.health();
      playersOnline += health.playersOnline;
      faces += health.faces;
      maxDepthReached = Math.max(maxDepthReached, health.maxDepthReached);
      totalClicks += health.totalClicks;
    }
    return {
      uptimeMs: Math.max(0, this.now() - this.startedAt),
      playersOnline,
      faces,
      maxDepthReached,
      totalClicks,
      planetsLoaded: this.cores.size,
    };
  }

  tick(now = this.now()) {
    for (const { core } of this.loadedPlanets()) core.tick(now);
  }

  async flush() {
    for (const { core } of this.loadedPlanets()) await core.flush();
    await this._registryChain.catch(() => {});
    return this;
  }

  async close() {
    for (const { core } of this.loadedPlanets()) {
      try {
        await core.close();
      } catch (err) {
        this.log('planet close failed:', err?.message || err);
      }
    }
    await this.saveRegistry();
    await this._registryChain.catch(() => {});
    return this;
  }
}

export default PlanetManager;
