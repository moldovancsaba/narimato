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
import { planetDepth, planetName, planetSource, missionForPlanet, missionProgress } from '../public/js/shared/mission.js';

export const REGISTRY_VERSION = 1;
/** Emergency supply: minimum pilot age and human message. */
export const SUPPLY_MIN_AGE_MS = 120_000;
export const SUPPLY_MESSAGE = 'EMERGENCY SUPPLY DROP // SALVAGE MARKED CELLS';
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

/**
 * Dynamic robot staffing rule for one planet scene:
 *   humans=0 -> 1 ambient robot
 *   humans=1 -> 2 robots
 *   humans=2 -> 1 robot
 *   humans>=3 -> 0 robots
 * Robots are never counted as humans.
 */
/** Random escape destination offset 1..5 (deterministic under an injected rng). */
export function randomEscapeDestination(index, rng = Math.random) {
  const from = Math.max(0, Math.trunc(Number(index) || 0));
  return from + 1 + Math.floor(rng() * 5);
}

export function robotTargetForOnlineHumans(humans) {
  const h = Math.max(0, Math.trunc(Number(humans) || 0));
  if (h <= 0) return 1;
  if (h === 1) return 2;
  if (h === 2) return 1;
  return 0;
}

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
    this._missionSeeds = new Map(); // planetIndex -> planetSeed the cached mission was derived from
    this._missionTopUp = new Set(); // planets already given their one-time legacy mission top-up
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

  /** Procedural mission for a planet, derived from this planet's seed. */
  missionForPlanet(index, planetSeed) {
    return missionForPlanet(index, planetSeed);
  }

  _missionSeedFor(index, core) {
    return Number.isInteger(core.planetSeed) ? core.planetSeed : 0;
  }

  /** Re-derive the mission when a planet's seed changes (meteor/incident/reset). */
  _syncMissionForPlanet(index, core, { ensure = false } = {}) {
    const seed = this._missionSeedFor(index, core);
    const cached = this._missionSeeds.get(index);
    if (cached === seed) return missionForPlanet(index, seed);
    const mission = missionForPlanet(index, seed);
    this._missionSeeds.set(index, seed);
    if (ensure) core.ensureMissionDeposits(mission);
    return mission;
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
      const planet0Mission = missionForPlanet(0, planet0.planetSeed);
      planet0.resetGrid({ mission: planet0Mission });
      planet0.ensureMissionDeposits(planet0Mission);
      this._missionSeeds.set(0, this._missionSeedFor(0, planet0));
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
    if (existing) {
      // One top-up per process for worlds created before procedural missions:
      // make sure an existing planet can actually satisfy its seed-derived refit.
      if (!this._missionTopUp.has(i)) {
        this._missionTopUp.add(i);
        existing.ensureMissionDeposits(missionForPlanet(i, existing.planetSeed));
      }
      return existing;
    }
    const core = await WorldCore.open({
      dataDir: this.planetDir(i),
      config: this.configForPlanet(i),
      now: this.now,
      rng: this.rng,
      autoSave: this.autoSave,
      quiet: this.quiet,
    });
    // A brand-new planet must be able to satisfy its refit (seed-derived mission).
    const mission = missionForPlanet(i, core.planetSeed);
    this._missionSeeds.set(i, this._missionSeedFor(i, core));
    const firstTopUp = !this._missionTopUp.has(i);
    this._missionTopUp.add(i);
    if (core.freshlyCreated) core.ensureMissionDeposits(mission);
    // If an older world contains cells deeper than this planet's configured
    // level cap (e.g. the pre-3.0 deep first planet), rebuild just the grid.
    let rebuilt = false;
    if (core._treeDepth() > core.config.maxDepth) {
      core.resetGrid({ mission });
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
      core.resetGrid({ mission });
      rebuilt = true;
      this.log(`planet ${i}: reseeded depleted grid (meteor recovery)`);
    }
    // Existing worlds from before procedural missions may not have the newly
    // required materials yet: top up once per process without resetting play.
    if (!rebuilt && firstTopUp) core.ensureMissionDeposits(mission);
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
    return {
      ...state,
      planetIndex: index,
      planetDepth: levels,
      planetLevels: levels,
      planetName: planetName(index),
      planetSource: planetSource(index),
    };
  }

  decorateJoin(result, index) {
    return {
      ...result,
      planetIndex: index,
      planetDepth: planetDepth(index),
      planetLevels: planetDepth(index),
      planetName: planetName(index),
      planetSource: planetSource(index),
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
    this.tick(this.now()); // apply staffing immediately for this planet scene
    return this.decorateJoin(result, index);
  }

  // ------------------------------------------------------------------ clicks

  /** Route a click; returns the core result + optional meteor payload. */
  async click({ token, label } = {}) {
    const { index, core } = await this.coreForToken(token);
    const result = core.click({ token, label });
    if (!result.ok) return { index, core, result, meteor: null };
    const player = core.findByToken(token);
    const mission = this._syncMissionForPlanet(index, core);
    const ready = player ? missionProgress(player.oreCounts || {}, mission).ready : false;
    const meteor = core.maybeMeteor({ missionReady: ready });
    if (meteor) this._syncMissionForPlanet(index, core, { ensure: true });
    return { index, core, result, meteor };
  }

  // --------------------------------------------------------------- supply

  /**
   * Authoritative emergency supply drop: while the current refit mission is
   * incomplete, place one hidden deposit per missing unit on nearby mineable
   * leaves (first-click mining). Repeatable every SUPPLY_MIN_AGE_MS of no
   * successful drop, so a stuck pilot is not abandoned.
   */
  async emergencySupply({ token, label = null } = {}) {
    const { index, core } = await this.coreForToken(token);
    const player = core.findByToken(token);
    if (!player) return fail('NOT_JOINED', 'Join with a valid token before requesting supply.');
    const mission = this._syncMissionForPlanet(index, core);
    const progress = missionProgress(player.oreCounts || {}, mission);
    if (progress.ready) return fail('MISSION_COMPLETE', 'Refit already complete — no drop needed.');
    const now = this.now();
    const lastDrop = Number.isFinite(player.supplyDropAt) ? player.supplyDropAt : 0;
    const lastEvent = Math.max(
      Number.isFinite(player.createdAt) ? player.createdAt : 0,
      lastDrop,
    );
    const ageMs = Math.max(0, now - lastEvent);
    if (ageMs < SUPPLY_MIN_AGE_MS) {
      return fail('SUPPLY_NOT_READY', 'No emergency drop is available yet.', { readyInMs: SUPPLY_MIN_AGE_MS - ageMs });
    }

    const units = [];
    for (const objective of mission.objectives) {
      for (const item of objective.items) {
        const have = (player.oreCounts && player.oreCounts[item.resourceId]) || 0;
        for (let k = 0; k < Math.max(0, item.need - have); k += 1) units.push(item.resourceId);
      }
    }
    if (!units.length) return fail('MISSION_COMPLETE', 'Refit already complete — no drop needed.');

    const placement = core.placeEmergencySupply({ units, hintLabel: label, player, planetIndex: index });
    if (!placement.cells.length) return fail('SUPPLY_UNAVAILABLE', 'No mineable cells available for a drop.');
    return {
      ok: true,
      planetIndex: index,
      impactLabel: placement.impactLabel,
      cells: placement.cells,
      resources: placement.resources,
      message: SUPPLY_MESSAGE,
      playerId: player.id,
      mission: progress,
      state: this.decorateState(core.getState(), index),
      leaves: core.getLeaves(),
    };
  }

  // --------------------------------------------------------------- surface sync

  /** Validate and return a transient surface pose; never persisted. */
  async surfacePose({ token, pos, heading = 0, moving = false } = {}) {
    const { index, core } = await this.coreForToken(token);
    const player = core.findByToken(token);
    if (!player) return fail('NOT_JOINED', 'Join with a valid token before surface movement.');
    const x = Number(pos && pos.x);
    const y = Number(pos && pos.y);
    const z = Number(pos && pos.z);
    const len = Math.hypot(x, y, z);
    if (!Number.isFinite(len) || len < 0.1) return fail('INVALID_POSE', 'Surface position must be a valid unit vector.');
    const unit = { x: x / len, y: y / len, z: z / len };
    const angle = Number.isFinite(Number(heading)) ? Number(heading) : 0;
    core.setSurfacePresence(player, unit, angle);
    return {
      ok: true,
      planetIndex: index,
      playerId: player.id,
      tag: player.tag,
      color: player.color,
      pos: unit,
      heading: angle,
      moving: !!moving,
    };
  }

  async surfaceLeave({ token } = {}) {
    const { index, core } = await this.coreForToken(token);
    const player = core.findByToken(token);
    if (!player) return fail('NOT_JOINED', 'Join with a valid token before surface movement.');
    core.clearSurfacePresence(player);
    return { ok: true, planetIndex: index, playerId: player.id, tag: player.tag };
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
    const mission = this._syncMissionForPlanet(index, core);
    const progress = missionProgress(player.oreCounts || {}, mission);
    if (!progress.ready) {
      return fail('MISSION_INCOMPLETE', 'The escape drive needs more ore.', { mission: progress });
    }
    // Random destination among the next five planets (never backwards).
    const nextIndex = randomEscapeDestination(index, this.rng);
    const nextCore = await this.ensurePlanet(nextIndex);
    const adopted = nextCore.adoptPlayer({
      tag: player.tag,
      token: player.token,
      color: player.color,
      score: player.score,
      id: player.id,
      // Carry the whole ore inventory so it can be used immediately on the
      // next planet's refit mission.
      ores: player.ores,
      oreValue: player.oreValue,
      oreCounts: player.oreCounts,
      suppliedPlanets: player.suppliedPlanets,
    });
    // Old clone becomes a permanent offline ghost on the planet we left.
    core.setOnline(player.id, false);
    this.registry.tokens[player.token] = nextIndex;
    await this.saveRegistry();
    this.tick(this.now()); // old planet may need a replacement; new planet re-staffs
    return {
      ok: true,
      token: adopted.token,
      player: adopted.player, // compact identity for the client
      oldPlanetIndex: index,
      planetIndex: nextIndex,
      planetDepth: planetDepth(nextIndex),
      planetLevels: planetDepth(nextIndex),
      planetName: planetName(nextIndex),
      planetSource: planetSource(nextIndex),
      mission: missionForPlanet(nextIndex, nextCore.planetSeed),
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

  /** Compute each planet's staffing target from its online humans, then tick. */
  tick(now = this.now()) {
    const botsDisabled = this.config.bots <= 0;
    for (const { index, core } of this.loadedPlanets()) {
      const target = botsDisabled ? 0 : robotTargetForOnlineHumans(core.onlineHumanCount());
      core.setRobotTarget(target);
      core.tick(now);
      // A seed change means a new procedurally generated refit mission: make
      // sure its guaranteed deposits exist.
      if (this._missionSeeds.get(index) !== this._missionSeedFor(index, core)) {
        this._syncMissionForPlanet(index, core, { ensure: true });
      }
    }
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
