const { v4: uuidv4 } = require('uuid');
const Play = require('../models/Play');
const Card = require('../models/Card');
const { fieldNames } = require('../constants/fieldNames');

/**
 * FUNCTIONAL: Vote-Only play service
 * STRATEGIC: Implements the specified UNRANKED/RANKED/PERSONAL flow with clean persistence
 */
class VoteOnlyService {
  /**
   * Start a new vote-only session: pick 2 random cards and return the initial comparison
   */
  async startSession(organizationId, deckTag) {
    // Fetch all active deck cards (tenant scoped)
    const cards = await Card.find({
      [fieldNames.OrganizationUUID]: organizationId,
      parentTag: deckTag,
      isActive: true
    });

    if (!cards || cards.length < 2) {
      throw new Error('Deck needs at least 2 cards to start vote-only session');
    }

    // Shuffle and pick two
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const [a, b, ...rest] = shuffled;

    const play = new Play({
      uuid: uuidv4(),
      [fieldNames.OrganizationUUID]: organizationId,
      deckTag,
      mode: 'vote_only',
      state: 'vote_only',
      status: 'active',
      cardIds: shuffled.map(c => c.uuid),
      // Initialize with an empty personal ranking; the first user vote seeds it (Steps 2-3)
      personalRanking: [],
      unrankedDeck: rest.map(c => c.uuid),
      rankedDeck: [a.uuid, b.uuid],
      activeChallenger: a.uuid,
      activeOpponent: b.uuid,
      voteHistory: []
    });

    await play.save();

    return {
      playId: play.uuid,
      mode: 'vote_only',
      cards: shuffled.map(c => this._toCardPayload(c)),
      comparison: {
        card1: this._toCardPayload(a),
        card2: this._toCardPayload(b)
      }
    };
  }

  /**
   * Start a vote-only session from a specific card list (preselected liked cards)
   * Used by rank-only mode after swipe segment completes
   */
  async startSessionFromCardIds(organizationId, deckTag, cardIds) {
    const cards = await Card.find({
      uuid: { $in: cardIds },
      [fieldNames.OrganizationUUID]: organizationId,
      isActive: true
    });
    if (!cards || cards.length < 2) {
      throw new Error('Need at least 2 cards to start vote-only segment');
    }
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const [a, b, ...rest] = shuffled;

    const play = new Play({
      uuid: uuidv4(),
      [fieldNames.OrganizationUUID]: organizationId,
      deckTag,
      mode: 'vote_only',
      state: 'vote_only',
      status: 'active',
      cardIds: shuffled.map(c => c.uuid),
      personalRanking: [],
      unrankedDeck: rest.map(c => c.uuid),
      rankedDeck: [a.uuid, b.uuid],
      activeChallenger: a.uuid,
      activeOpponent: b.uuid,
      voteHistory: []
    });

    await play.save();

    return {
      playId: play.uuid,
      mode: 'vote_only',
      cards: shuffled.map(c => this._toCardPayload(c)),
      comparison: { card1: this._toCardPayload(a), card2: this._toCardPayload(b) }
    };
  }

  /**
   * Submit a vote between two cards in the current comparison
   */
  async submitVote(playId, winner, loser) {
    const play = await Play.findOne({ uuid: playId, status: 'active', mode: 'vote_only' });
    if (!play) throw new Error('Play session not found or not active');

    // Establish current pair from active state to preserve challenger flow
    let challenger = play.activeChallenger;
    let opponent = play.activeOpponent;

    // Backward-compat: if active pair missing (older sessions), fallback to detection
    if (!challenger || !opponent) {
      const detected = this._detectChallenger(play, winner, loser);
      challenger = detected;
      opponent = detected === winner ? loser : winner;
    }

    // Normalize order if winner/loser not matching the current pair
    const pair = new Set([challenger, opponent]);
    if (!pair.has(winner) || !pair.has(loser)) {
      winner = challenger;
      loser = opponent;
    }

    // Deduplicate same vote within 2 seconds
    const now = Date.now();
    const recent = play.voteHistory[play.voteHistory.length - 1];
    if (recent && recent.winner === winner && recent.loser === loser) {
      const diff = now - new Date(recent.timestamp).getTime();
      if (diff < 2000) {
        return { deduped: true };
      }
    }

    // Record history
    play.voteHistory.push({ winner, loser, timestamp: new Date() });

    // If this is the seed vote (first comparison), initialize ranking directly per spec (Steps 2-3)
    if (play.personalRanking.length === 0) {
      // Step 2-3: rank the first pair into RANKED LIST
      play.personalRanking = [winner, loser];
      // Seed RANKED DECK as the initial list (baseline; challenger flow resets it later)
      play.rankedDeck = [winner, loser];
      // Clear active pair so next comparison introduces a challenger
      play.activeChallenger = undefined;
      play.activeOpponent = undefined;
      await play.save();

      // Asynchronous global ELO update after each vote
      try {
        const { updateGlobalRankings } = require('../utils/ranking');
        Promise.resolve(updateGlobalRankings(winner, loser)).catch(() => {});
      } catch (e) {}

      return { success: true, seeded: true };
    }

    // Apply algorithmic effects on RANKED and PERSONAL (Steps 7-12)
    if (challenger === winner) {
      // Challenger wins: delete opponent and all worse from RANKED,
      // move challenger to opponent's position in PERSONAL, shift worse down
      this._challengerWins(play, challenger, opponent);
    } else {
      // Challenger loses: delete opponent and all better from RANKED, challenger keeps position
      this._challengerLoses(play, challenger, opponent);
    }

    // If no more opponents remain for the challenger, clear active pair (next call will introduce new challenger)
    if (!play.rankedDeck || play.rankedDeck.length <= 1) {
      play.activeChallenger = undefined;
      play.activeOpponent = undefined;
    }

    await play.save();

    // Asynchronous global ELO update after each vote
    try {
      const { updateGlobalRankings } = require('../utils/ranking');
      Promise.resolve(updateGlobalRankings(winner, loser)).catch(() => {});
    } catch (e) {}

    return { success: true };
  }

  /**
   * Compute next comparison according to the flow
   */
  async getNextComparison(playId) {
    const play = await Play.findOne({ uuid: playId, mode: 'vote_only' });
    if (!play) throw new Error('Play session not found');

    // Continue with current challenger if possible
    if (play.activeChallenger && Array.isArray(play.rankedDeck) && play.rankedDeck.length > 1) {
      const opponent = this._randomOpponent(play.rankedDeck, play.activeChallenger);
      play.activeOpponent = opponent;
      await play.save();
      return { challenger: play.activeChallenger, opponent, completed: false };
    }

    // Clear active pair if exhausted
    if (play.activeChallenger && (!play.rankedDeck || play.rankedDeck.length <= 1)) {
      play.activeChallenger = undefined;
      play.activeOpponent = undefined;
    }

    // Introduce a new challenger from UNRANKED if available
    if (play.unrankedDeck && play.unrankedDeck.length > 0) {
      const challenger = play.unrankedDeck.shift();
      if (!play.personalRanking.includes(challenger)) {
        play.personalRanking.push(challenger);
      }
      // Reset rankedDeck to full candidate set (personal ranking) for this challenger
      play.rankedDeck = [...play.personalRanking];
      if (!play.rankedDeck.includes(challenger)) play.rankedDeck.push(challenger);

      const opponent = this._randomOpponent(play.rankedDeck, challenger);
      play.activeChallenger = challenger;
      play.activeOpponent = opponent;
      await play.save();

      return { challenger, opponent, completed: false };
    }

    // Completed
    play.status = 'completed';
    play.completedAt = new Date();
    await play.save();

    try { setTimeout(() => {}, 0); } catch (e) {}

    return { completed: true, finalRanking: play.personalRanking };
  }

  /**
   * Get final results payload with card details
   */
  async getResults(playId) {
    const play = await Play.findOne({ uuid: playId });
    if (!play) throw new Error('Play session not found');

    const cards = await Card.find({ uuid: { $in: play.cardIds } });
    const map = new Map(cards.map(c => [c.uuid, this._toCardPayload(c)]));

    return {
      playId: play.uuid,
      mode: play.mode,
      deckTag: play.deckTag,
      // Rich ranking objects for UI-first rendering
      ranking: play.personalRanking.map((id, idx) => ({
        rank: idx + 1,
        cardId: id,
        card: map.get(id) || { id }
      })),
      // Provide raw IDs as a conservative fallback for legacy UI code paths
      personalRanking: play.personalRanking,
      statistics: {
        totalCards: play.cardIds.length,
        totalComparisons: play.voteHistory.length
      }
    };
  }

  // --- Internal helpers -----------------------------------------------------

  _toCardPayload(card) {
    return {
      id: card.uuid,
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl
    };
  }

  _randomOpponent(rankedDeck, excludeId) {
    const options = rankedDeck.filter(id => id !== excludeId);
    const i = Math.floor(Math.random() * options.length);
    return options[i];
  }


  _randomPair(arr) {
    if (arr.length < 2) return [arr[0], arr[0]];
    const i = Math.floor(Math.random() * arr.length);
    let j;
    do { j = Math.floor(Math.random() * arr.length); } while (j === i);
    return [arr[i], arr[j]];
  }

  _detectChallenger(play, winner, loser) {
    // If one of the pair is the last added to rankedDeck and exists in PERSONAL at end, that’s challenger
    const lastRanked = play.rankedDeck[play.rankedDeck.length - 1];
    if (winner === lastRanked) return winner;
    if (loser === lastRanked) return loser;
    // Fallback: prefer the one recently appended to PERSONAL end
    const lastPersonal = play.personalRanking[play.personalRanking.length - 1];
    if (winner === lastPersonal) return winner;
    return loser;
  }

  _challengerWins(play, challenger, opponent) {
    // Remove opponent and all worse from RANKED based on PERSONAL order (worse = higher index)
    const oppPosPR = play.personalRanking.indexOf(opponent);
    if (oppPosPR >= 0) {
      const removeSet = new Set(play.personalRanking.filter((id, idx) => idx >= oppPosPR));
      play.rankedDeck = play.rankedDeck.filter(id => !removeSet.has(id) || id === challenger);
      if (!play.rankedDeck.includes(challenger)) play.rankedDeck.push(challenger);
    }

    // Move challenger to opponent's position in PERSONAL and shift worse down
    const oppPos = play.personalRanking.indexOf(opponent);
    if (oppPos >= 0) {
      const chalPos = play.personalRanking.indexOf(challenger);
      if (chalPos === -1) play.personalRanking.push(challenger);
      const curPos = play.personalRanking.indexOf(challenger);
      play.personalRanking.splice(curPos, 1);
      play.personalRanking.splice(oppPos, 0, challenger);
    }
  }

  _challengerLoses(play, challenger, opponent) {
    // Delete opponent and all better cards from RANKED based on PERSONAL order (better = lower index)
    const oppPosPR = play.personalRanking.indexOf(opponent);
    if (oppPosPR >= 0) {
      const removeSet = new Set(play.personalRanking.filter((id, idx) => idx <= oppPosPR));
      play.rankedDeck = play.rankedDeck.filter(id => !removeSet.has(id) || id === challenger);
      if (!play.rankedDeck.includes(challenger)) play.rankedDeck.unshift(challenger);
    }
    // Challenger keeps current PERSONAL position (ensure presence)
    if (!play.personalRanking.includes(challenger)) {
      play.personalRanking.push(challenger);
    }
  }
}

module.exports = VoteOnlyService;

