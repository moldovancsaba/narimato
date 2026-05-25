function pairwiseKey(a, b) {
  return [a, b].sort().join(':');
}

function mergePairwise(existing, votes) {
  const next = { ...existing };
  for (const v of votes) {
    if (!v.cardA || !v.cardB || !v.winner) continue;
    const key = pairwiseKey(v.cardA, v.cardB);
    if (!next[key]) next[key] = { winsA: 0, winsB: 0, n: 0, cardA: v.cardA, cardB: v.cardB };
    next[key].n += 1;
    if (v.winner === v.cardA) next[key].winsA += 1;
    else if (v.winner === v.cardB) next[key].winsB += 1;
  }
  return next;
}

function mergeSwipeRates(existing, swipes) {
  const next = { ...existing };
  for (const s of swipes) {
    if (!s.cardId) continue;
    if (!next[s.cardId]) next[s.cardId] = { left: 0, right: 0 };
    if (s.direction === 'left') next[s.cardId].left += 1;
    if (s.direction === 'right') next[s.cardId].right += 1;
  }
  return next;
}

function rankTopBottom(personalRanking, swipeRates, limit = 5) {
  const top = personalRanking.slice(0, limit);
  const bottomFromSwipes = Object.entries(swipeRates || {})
    .filter(([, r]) => r.left > r.right)
    .sort((a, b) => b[1].left - a[1].left)
    .map(([id]) => id)
    .slice(0, limit);
  const bottom = [...new Set([...personalRanking.slice(-limit), ...bottomFromSwipes])].slice(0, limit);
  return { topCardUuids: top, bottomCardUuids: bottom };
}

function computeConfidence(sessionCount) {
  if (sessionCount <= 0) return 0;
  if (sessionCount < 3) return 0.25;
  if (sessionCount < 5) return 0.5;
  if (sessionCount < 10) return 0.75;
  return 1;
}

/**
 * Merge one PlayFeedbackEvent into PlayFeedbackAggregate.
 */
async function mergeEventIntoAggregate(event, models) {
  const { PlayFeedbackAggregate } = models;
  const { organizationId, deckRootTag } = event;
  let agg = await PlayFeedbackAggregate.findOne({ organizationId, deckRootTag });
  if (!agg) {
    agg = new PlayFeedbackAggregate({
      organizationId,
      deckRootTag,
      sessionCount: 0,
      windowStartedAt: new Date(),
    });
  }

  agg.sessionCount = (agg.sessionCount || 0) + 1;
  agg.lastAggregatedAt = new Date();
  agg.pairwiseWins = mergePairwise(agg.pairwiseWins || {}, event.votes || []);
  agg.swipeRates = mergeSwipeRates(agg.swipeRates || {}, event.swipes || []);
  const { topCardUuids, bottomCardUuids } = rankTopBottom(
    event.personalRanking || [],
    agg.swipeRates
  );
  agg.topCardUuids = topCardUuids;
  agg.bottomCardUuids = bottomCardUuids;
  agg.confidence = computeConfidence(agg.sessionCount);
  await agg.save();
  return agg.toObject ? agg.toObject() : agg;
}

function buildTrainingBundle(event, aggregate, cardsByUuid) {
  const topCards = (event.personalRanking || [])
    .slice(0, 5)
    .map((uuid) => cardsByUuid[uuid])
    .filter(Boolean);
  const bottomCards = (aggregate?.bottomCardUuids || [])
    .map((uuid) => cardsByUuid[uuid])
    .filter(Boolean);

  return {
    playId: event.playId,
    deckRootTag: event.deckRootTag,
    mode: event.mode,
    sessionCount: aggregate?.sessionCount || 1,
    confidence: aggregate?.confidence || 0,
    personalRanking: event.personalRanking,
    topCards,
    bottomCards,
    swipeRates: event.swipes?.length ? aggregate?.swipeRates : {},
    cardSnapshots: event.cardSnapshots,
  };
}

module.exports = {
  mergeEventIntoAggregate,
  buildTrainingBundle,
  computeConfidence,
};
