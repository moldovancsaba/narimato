const { v4: uuidv4 } = require('uuid');
const VoteMorePlay = require('../models/VoteMorePlay');
const VoteOnlyService = require('./VoteOnlyService');
const Card = require('../models/Card');

/**
 * FUNCTIONAL: VoteMoreEngine orchestrates multiple vote-only segments across hierarchy
 * STRATEGIC: Mirrors SwipeMore flow but uses voting to rank within each family
 */
class VoteMoreEngine {
  static async startSession(organizationId, deckTag) {
    const engine = new VoteMoreEngine();
    return await engine.createSession(organizationId, deckTag);
  }

  static async processVote(sessionId, winner, loser) {
    const engine = new VoteMoreEngine();
    return await engine.processVote(sessionId, winner, loser);
  }

  static async getNext(sessionId) {
    const engine = new VoteMoreEngine();
    return await engine.getNext(sessionId);
  }

  static async getFinalRanking(sessionId) {
    const engine = new VoteMoreEngine();
    return await engine.getFinalRanking(sessionId);
  }

  // Create VoteMore session and start first vote-only family
  async createSession(organizationId, deckTag) {
    // Create master VoteMore session
    const session = new VoteMorePlay({
      uuid: uuidv4(),
      organizationId,
      deckTag,
      familiesToProcess: [{
        familyTag: deckTag,
        level: 0,
        context: 'root',
        status: 'pending'
      }],
      currentFamilyIndex: 0,
      activeVoteOnlySession: null,
      combinedRanking: [],
      decisionSequence: [],
      completed: false,
      status: 'active'
    });

    await session.save();

    // Start first vote-only segment
    const startRes = await (new VoteOnlyService()).startSession(organizationId, deckTag);

    session.activeVoteOnlySession = startRes.playId;
    const currentFamily = session.familiesToProcess[session.currentFamilyIndex];
    if (currentFamily) {
      currentFamily.sessionId = startRes.playId;
      currentFamily.status = 'active';
      currentFamily.startedAt = new Date();
    }
    session.decisionSequence.push({ step: 1, type: 'vote-family', familyTag: deckTag, level: 0, context: 'root', timestamp: new Date() });
    await session.save();

    return {
      playId: session.uuid,
      cards: startRes.cards,
      comparison: startRes.comparison,
      familyLevel: 0,
      familyContext: 'root'
    };
  }

  // Delegate a vote to the active vote-only segment
  async processVote(sessionId, winner, loser) {
    const session = await VoteMorePlay.findOne({ uuid: sessionId, status: 'active' });
    if (!session) throw new Error('VoteMore session not found or not active');
    if (!session.activeVoteOnlySession) throw new Error('No active vote-only segment');

    return await (new VoteOnlyService()).submitVote(session.activeVoteOnlySession, winner, loser);
  }

  // Get next comparison; on family completion, start next family or complete
  async getNext(sessionId) {
    const session = await VoteMorePlay.findOne({ uuid: sessionId, status: 'active' });
    if (!session) throw new Error('VoteMore session not found or not active');
    const currentFamily = session.familiesToProcess[session.currentFamilyIndex];

    if (!session.activeVoteOnlySession) {
      // No active segment: if there are pending families, start one
      if (session.currentFamilyIndex < session.familiesToProcess.length) {
        const nextFamily = session.familiesToProcess[session.currentFamilyIndex];
        const startRes = await (new VoteOnlyService()).startSession(session.organizationId, nextFamily.familyTag);
        session.activeVoteOnlySession = startRes.playId;
        nextFamily.sessionId = startRes.playId;
        nextFamily.status = 'active';
        nextFamily.startedAt = new Date();
        await session.save();
        return {
          completed: false,
          requiresMoreVoting: true,
          challenger: startRes.comparison.card1.id,
          opponent: startRes.comparison.card2.id,
          // Provide fresh card list for new family so UI can resolve titles/images
          cards: startRes.cards,
          hierarchicalLevel: nextFamily.level,
          familyContext: {
            familyTag: nextFamily.familyTag,
            level: nextFamily.level,
            context: nextFamily.context
          }
        };
      }
      // No more families
      return await this.completeSession(session);
    }

    // Ask vote-only service for next comparison
    const next = await (new VoteOnlyService()).getNextComparison(session.activeVoteOnlySession);
    if (!next || next.completed) {
      // Family completed: aggregate results and move on
      const familyResults = await (new VoteOnlyService()).getResults(session.activeVoteOnlySession);
      this.addFamilyToRanking(session, familyResults);
      this.markCurrentFamilyCompleted(session);

      // Enqueue children families for ranked cards that have children
      await this.enqueueChildrenFamilies(session, familyResults);

      // Advance family index
      session.currentFamilyIndex += 1;
      session.activeVoteOnlySession = null;
      await session.save();

      // Start next family or complete
      if (session.currentFamilyIndex >= session.familiesToProcess.length) {
        return await this.completeSession(session);
      }

      const nextFamily = session.familiesToProcess[session.currentFamilyIndex];
      const startRes = await (new VoteOnlyService()).startSession(session.organizationId, nextFamily.familyTag);
      session.activeVoteOnlySession = startRes.playId;
      nextFamily.sessionId = startRes.playId;
      nextFamily.status = 'active';
      nextFamily.startedAt = new Date();
      session.decisionSequence.push({ step: session.decisionSequence.length + 1, type: 'vote-family', familyTag: nextFamily.familyTag, level: nextFamily.level, context: nextFamily.context, timestamp: new Date() });
      await session.save();

      return {
        completed: false,
        requiresMoreVoting: true,
        challenger: startRes.comparison.card1.id,
        opponent: startRes.comparison.card2.id,
        // Provide fresh card list for new family so UI can resolve titles/images
        cards: startRes.cards,
        hierarchicalLevel: nextFamily.level,
        familyContext: {
          familyTag: nextFamily.familyTag,
          level: nextFamily.level,
          context: nextFamily.context
        }
      };
    }

    // Still within current family
    return {
      completed: false,
      challenger: next.challenger,
      opponent: next.opponent,
      familyContext: {
        familyTag: currentFamily?.familyTag || 'unknown',
        level: currentFamily?.level || 0,
        context: currentFamily?.context || 'unknown'
      }
    };
  }

  addFamilyToRanking(session, familyResults) {
    const currentFamily = session.familiesToProcess[session.currentFamilyIndex];
    const familyTag = currentFamily?.familyTag || 'unknown';
    const level = currentFamily?.level || 0;
    const context = currentFamily?.context || 'unknown';

    (familyResults.ranking || []).forEach(item => {
      session.combinedRanking.push({
        rank: item.rank,
        card: item.card,
        familyLevel: level,
        familyContext: context,
        familyTag,
        overallRank: session.combinedRanking.length + 1,
        familyRank: item.rank
      });
    });
  }

  markCurrentFamilyCompleted(session) {
    const currentFamily = session.familiesToProcess[session.currentFamilyIndex];
    if (currentFamily) {
      currentFamily.status = 'completed';
      currentFamily.completedAt = new Date();
    }
  }

  async enqueueChildrenFamilies(session, familyResults) {
    // For each ranked card, if it has children, enqueue that family
    for (const item of (familyResults.ranking || [])) {
      const cardId = item.card?.id || item.cardId;
      if (!cardId) continue;
      const parentCard = await Card.findOne({ uuid: cardId, organizationId: session.organizationId, isActive: true });
      if (parentCard && parentCard.isParent && parentCard.hasChildren) {
        session.familiesToProcess.push({
          familyTag: parentCard.name,
          level: (session.familiesToProcess[session.currentFamilyIndex]?.level || 0) + 1,
          context: `children-of-${parentCard.name}`,
          status: 'pending'
        });
      }
    }
  }

  async completeSession(session) {
    session.completed = true;
    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();
    return {
      completed: true,
      finalRanking: session.combinedRanking,
      statistics: {
        totalFamilies: session.familiesToProcess?.length || 0
      },
      decisionSequence: session.decisionSequence || []
    };
  }

  async getFinalRanking(sessionId) {
    const session = await VoteMorePlay.findOne({ uuid: sessionId });
    if (!session) return null;
    return {
      playId: sessionId,
      mode: 'vote-more',
      completed: session.completed,
      completedAt: session.completedAt,
      ranking: session.combinedRanking || [],
      statistics: {
        totalFamilies: session.familiesToProcess?.length || 0
      },
      decisionSequence: session.decisionSequence || []
    };
  }
}

module.exports = VoteMoreEngine;

