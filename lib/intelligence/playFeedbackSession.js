const { normalizeHashtag } = require('./projectionNormalizer');

function isPlayCompleted(play, results) {
  if (play?.isOnboarding) return false;
  if (play?.status === 'completed') return true;
  if (results?.completed === true) return true;
  if (results?.status === 'completed') return true;
  return false;
}

function extractPersonalRanking(play, results) {
  if (Array.isArray(results?.personalRanking) && results.personalRanking.length) {
    return results.personalRanking.map((id) => String(id));
  }
  if (Array.isArray(results?.ranking) && results.ranking.length) {
    return results.ranking
      .map((r) => r.cardId || r.card?.id || r.card?.uuid)
      .filter(Boolean);
  }
  if (Array.isArray(play?.personalRanking) && play.personalRanking.length) {
    return play.personalRanking.map((id) => String(id));
  }
  if (Array.isArray(play?.likedCards) && play.likedCards.length) {
    return [...play.likedCards]
      .sort((a, b) => (a.rank || 0) - (b.rank || 0))
      .map((e) => e.cardId)
      .filter(Boolean);
  }
  if (Array.isArray(play?.rankedDeck) && play.rankedDeck.length) {
    return play.rankedDeck.map((id) => String(id));
  }
  return [];
}

function extractSwipes(play) {
  if (!Array.isArray(play?.swipes)) return [];
  return play.swipes.map((s) => ({
    cardId: s.cardId,
    direction: s.direction,
    timestamp: s.timestamp || s.at || new Date(),
  }));
}

function extractVotes(play) {
  const votes = [];
  if (Array.isArray(play?.votes)) {
    for (const v of play.votes) {
      votes.push({
        cardA: v.cardA,
        cardB: v.cardB,
        winner: v.winner,
        timestamp: v.timestamp || new Date(),
      });
    }
  }
  if (Array.isArray(play?.voteHistory)) {
    for (const v of play.voteHistory) {
      votes.push({
        cardA: v.winner,
        cardB: v.loser,
        winner: v.winner,
        timestamp: v.timestamp || new Date(),
      });
    }
  }
  return votes;
}

function resolvePlayMode(play) {
  if (play?.mode) return play.mode;
  if (play?.likedCards) return 'swipe_only';
  return 'classic';
}

function participationCount(play, personalRanking, swipes, votes) {
  const ids = new Set();
  personalRanking.forEach((id) => ids.add(id));
  swipes.forEach((s) => ids.add(s.cardId));
  votes.forEach((v) => {
    if (v.cardA) ids.add(v.cardA);
    if (v.cardB) ids.add(v.cardB);
  });
  if (ids.size > 0) return ids.size;
  if (Array.isArray(play?.cardIds)) return play.cardIds.length;
  return 0;
}

function normalizePlaySession(play, results = {}) {
  const deckRootTag = normalizeHashtag(play.deckTag || play.parentTag || results.deckTag);
  const personalRanking = extractPersonalRanking(play, results);
  const swipes = extractSwipes(play);
  const votes = extractVotes(play);
  const cardUuids = [
    ...new Set([
      ...personalRanking,
      ...swipes.map((s) => s.cardId),
      ...votes.flatMap((v) => [v.cardA, v.cardB].filter(Boolean)),
      ...(play.cardIds || []),
    ]),
  ].filter(Boolean);

  return {
    playId: play.uuid,
    organizationId: play.organizationId,
    deckRootTag,
    mode: resolvePlayMode(play),
    completedAt: play.completedAt || results.completedAt || new Date(),
    personalRanking,
    swipes,
    votes,
    cardUuids,
    participationCount: participationCount(play, personalRanking, swipes, votes),
  };
}

module.exports = {
  isPlayCompleted,
  normalizePlaySession,
  extractPersonalRanking,
};
