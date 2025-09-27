// FUNCTIONAL: Rank-Only Engine — two-phase (swipe-only → vote-only)
// STRATEGIC: Reuses existing SwipeOnlyEngine and VoteOnlyService to minimize new logic

const { v4: uuidv4 } = require('uuid');
const RankOnlyPlay = require('../models/RankOnlyPlay');
const SwipeOnlyPlay = require('../models/SwipeOnlyPlay');
const Card = require('../models/Card');
const SwipeOnlyEngine = require('./SwipeOnlyEngine');
const VoteOnlyService = require('./VoteOnlyService');

class RankOnlyEngine {
  constructor() {
    this.mode = 'rank_only';
    this.voteService = new VoteOnlyService();
  }

  // Start: create swipe-only segment and wrap in RankOnlyPlay
  async startSession(organizationId, deckTag) {
    // Start swipe-only session
    const swipe = await SwipeOnlyEngine.startSession(organizationId, deckTag);

    // Create rank-only orchestration record
    const ro = new RankOnlyPlay({
      uuid: uuidv4(),
      organizationId,
      deckTag,
      status: 'active',
      phase: 'swipe',
      swipeSessionId: swipe.playId,
      likedCardIds: []
    });
    await ro.save();

    return {
      playId: ro.uuid,
      initial: {
        cards: swipe.initial?.cards || swipe.cards,
        currentCardId: swipe.initial?.currentCardId || swipe.currentCardId
      }
    };
  }

  // Handle input delegates to current phase
  async handleInput(playId, { action, payload }) {
    const ro = await RankOnlyPlay.findOne({ uuid: playId, status: 'active' });
    if (!ro) {
      const err = new Error('Rank-Only session not found or not active');
      err.statusCode = 404;
      throw err;
    }

    if (ro.phase === 'swipe') {
      if (action !== 'swipe') {
        const err = new Error('Unsupported action for rank_only in swipe phase');
        err.statusCode = 400;
        throw err;
      }
      const { cardId, direction } = payload || {};
      const res = await SwipeOnlyEngine.processSwipe(ro.swipeSessionId, cardId, direction);
      if (res.completed) {
        // Gather liked cards from the swipe-only session
        const swipeDoc = await SwipeOnlyPlay.findOne({ uuid: ro.swipeSessionId });
        const likedIds = (swipeDoc?.likedCards || []).map(l => l.cardId);
        ro.likedCardIds = likedIds;

        if (!likedIds || likedIds.length < 2) {
          // Not enough cards to vote — finalize with swipe order
          ro.phase = 'completed';
          ro.status = 'completed';
          ro.finalRanking = likedIds || [];
          ro.completedAt = new Date();
          await ro.save();
          return { completed: true };
        }

        // Start vote-only session over liked cards
        const vote = await this.voteService.startSessionFromCardIds(swipeDoc.organizationId, swipeDoc.deckTag, likedIds);
        ro.phase = 'vote';
        ro.voteSessionId = vote.playId;
        await ro.save();

        // Signal client to switch to voting
        return {
          completed: false,
          requiresVoting: true,
          votingContext: {
            newCard: vote.comparison.card1.id,
            compareWith: vote.comparison.card2.id
          }
        };
      }
      return res; // Continue swiping
    }

    if (ro.phase === 'vote') {
      if (action !== 'vote') {
        const err = new Error('Unsupported action for rank_only in vote phase');
        err.statusCode = 400;
        throw err;
      }
      const { winner, loser } = payload || {};
      return await this.voteService.submitVote(ro.voteSessionId, winner, loser);
    }

    // Completed
    return { completed: true };
  }

  // Next step depending on phase
  async getNext(playId) {
    const ro = await RankOnlyPlay.findOne({ uuid: playId });
    if (!ro) {
      const err = new Error('Rank-Only session not found');
      err.statusCode = 404;
      throw err;
    }
    if (ro.phase === 'swipe') {
      return await SwipeOnlyEngine.getCurrentCard(ro.swipeSessionId);
    }
    if (ro.phase === 'vote') {
      return await this.voteService.getNextComparison(ro.voteSessionId);
    }
    return { completed: true };
  }

  // Aggregate results (from vote session if present, else from swipe liked order)
  async getResults(playId) {
    const ro = await RankOnlyPlay.findOne({ uuid: playId });
    if (!ro) {
      const err = new Error('Rank-Only session not found');
      err.statusCode = 404;
      throw err;
    }

    if (ro.phase === 'vote' && ro.voteSessionId) {
      // Pull vote-only results and rebrand as rank_only
      const voteRes = await this.voteService.getResults(ro.voteSessionId);
      return {
        playId: ro.uuid,
        mode: 'rank_only',
        deckTag: ro.deckTag,
        ranking: voteRes.ranking,
        personalRanking: voteRes.personalRanking,
        statistics: voteRes.statistics
      };
    }

    // Swipe-only completion or not enough liked cards
    const liked = ro.likedCardIds || [];
    const cards = await Card.find({ uuid: { $in: liked } });
    const map = new Map(cards.map(c => [c.uuid, { id: c.uuid, title: c.title, description: c.description, imageUrl: c.imageUrl }]));
    const ranking = liked.map((id, idx) => ({ rank: idx + 1, cardId: id, card: map.get(id) || { id } }));

    return {
      playId: ro.uuid,
      mode: 'rank_only',
      deckTag: ro.deckTag,
      ranking,
      personalRanking: liked,
      statistics: { totalCards: liked.length, totalComparisons: 0 }
    };
  }
}

module.exports = new RankOnlyEngine();

