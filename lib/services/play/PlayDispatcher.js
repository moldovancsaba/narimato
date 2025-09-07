// FUNCTIONAL: Central dispatcher routing Play API calls to mode-specific engines
// STRATEGIC: Single stable API surface for all play modes with pluggable engines

const Play = require('../../models/Play');
const SwipeOnlyPlay = require('../../models/SwipeOnlyPlay');
const SwipeMorePlay = require('../../models/SwipeMorePlay');
const VoteMorePlay = require('../../models/VoteMorePlay');
const RankOnlyPlay = require('../../models/RankOnlyPlay');
const RankMorePlay = require('../../models/RankMorePlay');
const VoteOnlyService = require('../VoteOnlyService');
const SwipeOnlyEngine = require('../SwipeOnlyEngine');
const SwipeMoreEngine = require('../SwipeMoreEngine');
const VoteMoreEngine = require('../VoteMoreEngine');
const RankOnlyEngine = require('../RankOnlyEngine');
const RankMoreEngine = require('../RankMoreEngine');

// Engine interface adapter for Vote-Only (wraps existing service)
class VoteOnlyEngine {
  constructor() {
    this.service = new VoteOnlyService();
    this.mode = 'vote_only';
  }

  async startSession(organizationId, deckTag) {
    const res = await this.service.startSession(organizationId, deckTag);
    return {
      playId: res.playId,
      initial: {
        cards: res.cards,
        comparison: res.comparison
      }
    };
  }

  async handleInput(playId, { action, payload }) {
    if (action !== 'vote') {
      const err = new Error('Unsupported action for vote_only');
      err.statusCode = 400;
      throw err;
    }
    const { winner, loser } = payload || {};
    return await this.service.submitVote(playId, winner, loser);
  }

  async getNext(playId) {
    return await this.service.getNextComparison(playId);
  }

  async getResults(playId) {
    return await this.service.getResults(playId);
  }
}

// Engine interface adapter for Swipe-Only (wraps existing engine)
class SwipeOnlyAdapter {
  constructor() {
    this.mode = 'swipe_only';
  }
  async startSession(organizationId, deckTag) {
    const res = await SwipeOnlyEngine.startSession(organizationId, deckTag);
    return {
      playId: res.playId,
      initial: {
        cards: res.cards,
        currentCardId: res.currentCardId
      }
    };
  }
  async handleInput(playId, { action, payload }) {
    if (action !== 'swipe') {
      const err = new Error('Unsupported action for swipe_only');
      err.statusCode = 400;
      throw err;
    }
    const { cardId, direction } = payload || {};
    return await SwipeOnlyEngine.processSwipe(playId, cardId, direction);
  }
  async getNext(playId) {
    return await SwipeOnlyEngine.getCurrentCard(playId);
  }
  async getResults(playId) {
    return await SwipeOnlyEngine.getFinalRanking(playId);
  }
}

// Engine interface adapter for Swipe-More (built from swipe-only blocks)
class SwipeMoreAdapter {
  constructor() {
    this.mode = 'swipe_more';
  }
  async startSession(organizationId, deckTag) {
    const res = await SwipeMoreEngine.startSession(organizationId, deckTag);
    // Normalize to the dispatcher initial shape
    return {
      playId: res.playId,
      initial: {
        cards: res.cards,
        currentCardId: res.currentCardId,
        currentCard: res.currentCard,
        familyLevel: res.familyLevel,
        familyContext: res.familyContext
      }
    };
  }
  async handleInput(playId, { action, payload }) {
    if (action === 'swipe') {
      const { cardId, direction } = payload || {};
      return await SwipeMoreEngine.processSwipe(playId, cardId, direction);
    }
    if (action === 'vote') {
      const { cardA, cardB, winner } = payload || {};
      return await SwipeMoreEngine.processVote(playId, cardA, cardB, winner);
    }
    const err = new Error('Unsupported action for swipe_more');
    err.statusCode = 400;
    throw err;
  }
  async getNext(playId) {
    return await SwipeMoreEngine.getCurrentCard(playId);
  }
  async getResults(playId) {
    return await SwipeMoreEngine.getFinalRanking(playId);
  }
}

// Engine interface adapter for Vote-More (composed of vote-only segments)
class VoteMoreAdapter {
  constructor() {
    this.mode = 'vote_more';
  }
  async startSession(organizationId, deckTag) {
    const res = await VoteMoreEngine.startSession(organizationId, deckTag);
    return {
      playId: res.playId,
      initial: {
        cards: res.cards,
        comparison: res.comparison,
        familyLevel: res.familyLevel,
        familyContext: res.familyContext
      }
    };
  }
  async handleInput(playId, { action, payload }) {
    if (action !== 'vote') {
      const err = new Error('Unsupported action for vote_more');
      err.statusCode = 400;
      throw err;
    }
    const { winner, loser } = payload || {};
    return await VoteMoreEngine.processVote(playId, winner, loser);
  }
  async getNext(playId) {
    return await VoteMoreEngine.getNext(playId);
  }
  async getResults(playId) {
    return await VoteMoreEngine.getFinalRanking(playId);
  }
}

// Registry of engines by mode
const engines = {
  vote_only: new VoteOnlyEngine(),
  swipe_only: new SwipeOnlyAdapter(),
  swipe_more: new SwipeMoreAdapter(),
  vote_more: new VoteMoreAdapter(),
  rank_only: RankOnlyEngine,
  rank_more: RankMoreEngine,
};

async function getPlayAndEngine(playId) {
  // Try Play (vote_only / classic)
  let play = await Play.findOne({ uuid: playId });
  if (play) {
    const engine = engines[play.mode];
    if (!engine) {
      const err = new Error(`No engine registered for mode: ${play.mode}`);
      err.statusCode = 501;
      throw err;
    }
    return { play, engine };
  }

  // Try SwipeOnlyPlay
  const so = await SwipeOnlyPlay.findOne({ uuid: playId });
  if (so) {
    return { play: so, engine: engines['swipe_only'] };
  }

  // Try SwipeMorePlay
  const sm = await SwipeMorePlay.findOne({ uuid: playId });
  if (sm) {
    return { play: sm, engine: engines['swipe_more'] };
  }

  // Try VoteMorePlay
  const vm = await VoteMorePlay.findOne({ uuid: playId });
  if (vm) {
    return { play: vm, engine: engines['vote_more'] };
  }

// Try RankOnlyPlay
  const ro = await RankOnlyPlay.findOne({ uuid: playId });
  if (ro) {
    return { play: ro, engine: engines['rank_only'] };
  }

  // Try RankMorePlay
  const rmore = await RankMorePlay.findOne({ uuid: playId });
  if (rmore) {
    return { play: rmore, engine: engines['rank_more'] };
  }

  const err = new Error('Play not found');
  err.statusCode = 404;
  throw err;
}

async function getEngineByMode(mode) {
  const engine = engines[mode];
  if (!engine) {
    const err = new Error(`Unsupported mode: ${mode}`);
    err.statusCode = 400;
    throw err;
  }
  return engine;
}

module.exports = {
  getPlayAndEngine,
  getEngineByMode,
};

