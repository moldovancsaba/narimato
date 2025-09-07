// FUNCTIONAL: Rank-More Engine — hierarchical multi-level ranking via Rank-Only sub-sessions
// STRATEGIC: Reuses RankOnlyEngine to minimize duplication; orchestrates family-by-family ranking

const { v4: uuidv4 } = require('uuid');
const Card = require('../models/Card');
const RankMorePlay = require('../models/RankMorePlay');
const RankOnlyPlay = require('../models/RankOnlyPlay');
const RankOnlyEngine = require('./RankOnlyEngine');

class RankMoreEngine {
  constructor() {
    this.mode = 'rank_more';
  }

  // Start: create a master Rank-More session and a root Rank-Only sub-session
  async startSession(organizationId, deckTag) {
    // Start Rank-Only over root level (children of deckTag)
    const ro = await RankOnlyEngine.startSession(organizationId, deckTag);

    const session = new RankMorePlay({
      uuid: uuidv4(),
      organizationId,
      deckTag,
      status: 'active',
      phase: 'roots_swipe',
      currentLevel: 0,
      rankedRoots: [],
      activeRankOnlySession: ro.playId,
      pendingFamilies: [],
      perFamilyResults: [],
      finalOrder: []
    });
    await session.save();

    return {
      playId: session.uuid,
      initial: {
        cards: ro.initial?.cards,
        currentCardId: ro.initial?.currentCardId,
        familyLevel: 0,
        familyContext: { type: 'root', familyTag: deckTag }
      }
    };
  }

  // Delegate input to active Rank-Only sub-session; manage phase transitions
  async handleInput(playId, { action, payload }) {
    const session = await RankMorePlay.findOne({ uuid: playId, status: 'active' });
    if (!session) {
      const err = new Error('Rank-More session not found or not active');
      err.statusCode = 404; throw err;
    }
    if (!session.activeRankOnlySession) {
      const err = new Error('No active sub-session');
      err.statusCode = 409; throw err;
    }

    // Forward to Rank-Only engine
    const result = await RankOnlyEngine.handleInput(session.activeRankOnlySession, { action, payload });

    // Roots flow: when Rank-Only signals start of voting
    if (session.phase === 'roots_swipe' && result && result.requiresVoting) {
      session.phase = 'roots_vote';
      await session.save();
      return result; // { requiresVoting, votingContext }
    }

    // Regular swipe progression within any sub-session
    if (result && result.nextCardId) {
      return result;
    }

    // If sub-session swipe completed with <2 liked, Rank-Only returns { completed: true }
    // We'll advance orchestration here (either move to next family or complete)
    if (result && result.completed === true && action === 'swipe') {
      // Check if we just completed ROOTS or a FAMILY
      if (session.phase === 'roots_swipe') {
        // Roots completed with <2 liked (no voting). Aggregate and build families.
        await this._onRootsCompleted(session, /*viaVoting=*/false);
        // Start first family if any, otherwise finalize
        return await this._startNextFamilyOrComplete(session);
      }
      if (session.phase === 'family') {
        // Family swipe completed with <2 liked -> store empty or single ranking and move on
        await this._onFamilyCompleted(session);
        return await this._startNextFamilyOrComplete(session);
      }
    }

    // Voting inputs are just forwarded; family transitions are handled in getNext()
    return result;
  }

  // Next: ask sub Rank-Only for next item; on completion, aggregate and move to next family/level
  async getNext(playId) {
    const session = await RankMorePlay.findOne({ uuid: playId });
    if (!session) { const err = new Error('Rank-More session not found'); err.statusCode = 404; throw err; }
    if (!session.activeRankOnlySession) {
      // No active sub-session: either start next family or we're done
      return await this._startNextFamilyOrComplete(session);
    }

    const next = await RankOnlyEngine.getNext(session.activeRankOnlySession);

    // Continue within current sub-session
    if (next && !next.completed) {
      // Enrich with family context for UI (no breadcrumbs)
      const context = session.phase === 'family'
        ? { familyTag: session.activeParentName, level: session.currentLevel, context: `children-of-${session.activeParentName}` }
        : { familyTag: session.deckTag, level: 0, context: 'root' };
      return { ...next, familyContext: context };
    }

    // Sub-session completed -> aggregate and move on
    if (session.phase === 'roots_vote') {
      await this._onRootsCompleted(session, /*viaVoting=*/true);
      return await this._startNextFamilyOrComplete(session);
    }

    if (session.phase === 'family') {
      await this._onFamilyCompleted(session);
      return await this._startNextFamilyOrComplete(session);
    }

    // Fallback
    return { completed: true };
  }

  // Results: flatten parent followed by recursively ranked descendants
  async getResults(playId) {
    const session = await RankMorePlay.findOne({ uuid: playId });
    if (!session) { const err = new Error('Rank-More session not found'); err.statusCode = 404; throw err; }

    if (session.status !== 'completed') {
      // If somehow requested early, attempt to finalize
      await this._finalizeIfPossible(session);
    }

    // Build flattened list using stored structures
    const order = await this._buildFlattenedOrder(session);
    return {
      playId: session.uuid,
      mode: 'rank_more',
      deckTag: session.deckTag,
      personalRanking: order, // flattened list only, per spec
      ranking: order.map((id, idx) => ({ rank: idx + 1, cardId: id })),
      statistics: { totalItems: order.length }
    };
  }

  // --- Internals --------------------------------------------------------------

  async _onRootsCompleted(session, viaVoting) {
    // Collect root ranking either from vote session or from swipe liked order
    if (viaVoting) {
      const res = await RankOnlyEngine.getResults(session.activeRankOnlySession);
      session.rankedRoots = res.personalRanking || [];
    } else {
      // Root swipe ended <2 liked -> fetch RO doc
      const ro = await RankOnlyPlay.findOne({ uuid: session.activeRankOnlySession });
      session.rankedRoots = ro?.likedCardIds || [];
    }

    // Prepare first-level families: only parents with children
    const parents = await Card.find({ uuid: { $in: session.rankedRoots }, organizationId: session.organizationId, isActive: true });
    const withChildren = parents.filter(p => p.isParent && p.hasChildren);

    // Shuffle families (random order within the level)
    const families = withChildren.map(p => ({ parentId: p.uuid, parentName: p.name, familyTag: p.name, level: 1, status: 'pending' }));
    this._shuffleInPlace(families);

    session.pendingFamilies = families;
    session.currentFamilyIndex = 0;
    session.phase = families.length > 0 ? 'family' : 'completed';

    // Clear root sub-session; we'll start family sub-sessions next
    session.activeRankOnlySession = null;

    if (families.length === 0) {
      await this._finalizeIfPossible(session);
    }

    await session.save();
  }

  async _onFamilyCompleted(session) {
    // Gather results of the active family Rank-Only sub-session
    const res = await RankOnlyEngine.getResults(session.activeRankOnlySession);
    const parentId = session.activeParentId;
    const parentName = session.activeParentName;
    const rankingIds = res.personalRanking || [];

    session.perFamilyResults.push({ parentId, parentName, ranking: rankingIds });

    // Enqueue next-level families from liked children that have children
    if (rankingIds.length > 0) {
      const children = await Card.find({ uuid: { $in: rankingIds }, organizationId: session.organizationId, isActive: true });
      const promotable = children.filter(c => c.isParent && c.hasChildren);
      const current = session.pendingFamilies[session.currentFamilyIndex];
      const nextLevel = ((current?.level) || ((session.currentLevel || 0) + 1)) + 1; // child level = current family level + 1
      const newFamilies = promotable.map(c => ({ parentId: c.uuid, parentName: c.name, familyTag: c.name, level: nextLevel, status: 'pending' }));

      // Append; we'll shuffle when we switch to that level
      session.pendingFamilies.push(...newFamilies);
    }

    // Mark current family completed and clear sub-session
    const current = session.pendingFamilies[session.currentFamilyIndex];
    if (current) {
      current.status = 'completed';
      current.completedAt = new Date();
    }
    session.activeRankOnlySession = null;
    session.activeParentId = null;
    session.activeParentName = null;

    await session.save();
  }

  async _startNextFamilyOrComplete(session) {
    // Find next pending family at the CURRENT level first
    let nextIdx = -1;
    for (let i = session.currentFamilyIndex; i < session.pendingFamilies.length; i++) {
      const fam = session.pendingFamilies[i];
      if (fam && fam.status === 'pending' && fam.level === (session.currentLevel || 0) + 1) {
        nextIdx = i; break;
      }
    }

    if (nextIdx === -1) {
      // No more families at this level — advance to next level if any pending
      const currentLevelBase = (session.currentLevel || 0) + 1; // current families' level
      const nextPlannedLevel = currentLevelBase + 1; // next level to process
      const anyPending = session.pendingFamilies.some(f => f.status === 'pending' && f.level >= nextPlannedLevel);
      if (!anyPending) {
        // Nothing left → finalize
        session.phase = 'completed';
        await this._finalizeIfPossible(session);
        await session.save();
        return { completed: true };
      }

      // Move to the next level and shuffle that subset
      const levelFamilies = session.pendingFamilies.filter(f => f.status === 'pending' && f.level === nextPlannedLevel);
      this._shuffleInPlace(levelFamilies);

      // Reorder pendingFamilies to place the shuffled level families next
      const others = session.pendingFamilies.filter(f => !(f.status === 'pending' && f.level === nextPlannedLevel));
      session.pendingFamilies = [...levelFamilies, ...others];
      session.currentLevel = nextPlannedLevel - 1; // set base to previous of new level
      session.currentFamilyIndex = 0;
      await session.save();

      // Try again to start the next family
      return await this._startNextFamilyOrComplete(session);
    }

    // Start next family Rank-Only sub-session
    session.currentFamilyIndex = nextIdx;
    const fam = session.pendingFamilies[nextIdx];
    fam.status = 'active';
    fam.startedAt = new Date();

    // Start Rank-Only over this family's children
    const startRes = await RankOnlyEngine.startSession(session.organizationId, fam.familyTag);
    fam.sessionId = startRes.playId;

    session.activeRankOnlySession = startRes.playId;
    session.activeParentId = fam.parentId;
    session.activeParentName = fam.parentName;
    session.phase = 'family';
    session.currentLevel = fam.level - 1; // roots = 0, children level = 1 → currentLevel=0 during first families

    await session.save();

    // Return initial swipe state for the new family
    return {
      completed: false,
      returnToSwipe: true,
      nextCardId: startRes.initial?.currentCardId,
      cards: startRes.initial?.cards,
      hierarchicalLevel: fam.level,
      familyContext: { familyTag: fam.familyTag, level: fam.level, context: `children-of-${fam.parentName}` }
    };
  }

  async _finalizeIfPossible(session) {
    if (session.phase !== 'completed') return;
    const order = await this._buildFlattenedOrder(session);
    session.finalOrder = order;
    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();
  }

  async _buildFlattenedOrder(session) {
    // Build a map for quick lookup of children ranking per parentId
    const byParent = new Map();
    for (const r of session.perFamilyResults) {
      byParent.set(r.parentId, r.ranking || []);
    }

    // Recursive DFS flatten using root order then nested ranked children
    const out = [];
    const visit = (id) => {
      out.push(id);
      const kids = byParent.get(id) || [];
      for (const childId of kids) visit(childId);
    };

    for (const rootId of session.rankedRoots || []) {
      visit(rootId);
    }

    return out;
  }

  _shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

module.exports = new RankMoreEngine();
