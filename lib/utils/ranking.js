// Binary Search Ranking for Personal Rankings with Accumulated Bounds
function insertIntoPersonalRanking(ranking, newCardId, winner, cardA, cardB, allVotes = []) {
  if (ranking.length === 0) {
    return [newCardId];
  }

  // Calculate accumulated search bounds from ALL previous votes for this card
  const bounds = calculateAccumulatedSearchBounds(newCardId, ranking, allVotes);
  
  // If search space has collapsed, insert at determined position
  if (bounds.start >= bounds.end) {
    const insertPosition = bounds.start;
    const newRanking = [...ranking];
    newRanking.splice(insertPosition, 0, newCardId);
    return newRanking;
  }
  
  // If we have a current vote result, update bounds
  if (winner && (cardA === newCardId || cardB === newCardId)) {
    const comparedCardId = cardA === newCardId ? cardB : cardA;
    const comparedIndex = ranking.indexOf(comparedCardId);
    
    if (comparedIndex !== -1) {
      if (winner === newCardId) {
        // New card won: ranks higher, narrow upper bound
        bounds.end = Math.min(bounds.end, comparedIndex);
      } else {
        // New card lost: ranks lower, narrow lower bound
        bounds.start = Math.max(bounds.start, comparedIndex + 1);
      }
    }
  }
  
  // If bounds collapsed after this vote, insert at position
  if (bounds.start >= bounds.end) {
    const insertPosition = bounds.start;
    const newRanking = [...ranking];
    newRanking.splice(insertPosition, 0, newCardId);
    return newRanking;
  }
  
  // Still need more votes - return current ranking without insertion
  return ranking;
}

// Calculate accumulated search bounds from all previous votes
function calculateAccumulatedSearchBounds(targetCardId, ranking, allVotes) {
  let searchStart = 0;
  let searchEnd = ranking.length;
  
  // Process ALL votes involving this card to accumulate constraints
  for (const vote of allVotes) {
    if (vote.cardA === targetCardId || vote.cardB === targetCardId) {
      // Determine comparison card and its position
      const comparedCardId = vote.cardA === targetCardId ? vote.cardB : vote.cardA;
      const comparedIndex = ranking.indexOf(comparedCardId);
      
      if (comparedIndex !== -1) {
        if (vote.winner === targetCardId) {
          // Target won: ranks higher, narrow upper bound
          searchEnd = Math.min(searchEnd, comparedIndex);
        } else {
          // Target lost: ranks lower, narrow lower bound  
          searchStart = Math.max(searchStart, comparedIndex + 1);
        }
      }
    }
  }
  
  return { start: searchStart, end: searchEnd };
}

// Get next comparison for binary search with accumulated bounds
function getNextComparison(personalRanking, newCardId, allVotes = []) {
  if (personalRanking.length === 0) return null;
  if (personalRanking.includes(newCardId)) return null;
  
  // Calculate current search bounds
  const bounds = calculateAccumulatedSearchBounds(newCardId, personalRanking, allVotes);
  
  // If search space has collapsed, no more comparisons needed
  if (bounds.start >= bounds.end) {
    return null;
  }
  
  // Find middle card in current search space
  const middleIndex = Math.floor((bounds.start + bounds.end) / 2);
  
  // Ensure we don't exceed ranking bounds
  if (middleIndex >= personalRanking.length) {
    return null;
  }
  
  const candidateCard = personalRanking[middleIndex];
  
  // Check if we've already compared against this card
  const alreadyCompared = allVotes.some(vote => 
    (vote.cardA === newCardId && vote.cardB === candidateCard) ||
    (vote.cardB === newCardId && vote.cardA === candidateCard)
  );
  
  if (alreadyCompared) {
    // Skip to avoid redundant comparisons
    return null;
  }
  
  return candidateCard;
}

// ELO Rating System for Global Rankings
function calculateELO(winnerRating, loserRating, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
  
  const newWinnerRating = Math.round(winnerRating + kFactor * (1 - expectedWinner));
  const newLoserRating = Math.round(loserRating + kFactor * (0 - expectedLoser));
  
  return {
    winnerRating: newWinnerRating,
    loserRating: newLoserRating
  };
}

// Update global rankings after a vote
async function updateGlobalRankings(winnerId, loserId) {
  const Card = require('../models/Card');
  
  const [winner, loser] = await Promise.all([
    Card.findOne({ uuid: winnerId }),
    Card.findOne({ uuid: loserId })
  ]);
  
  if (!winner || !loser) return;
  
  const { winnerRating, loserRating } = calculateELO(
    winner.globalScore, 
    loser.globalScore
  );
  
  await Promise.all([
    Card.updateOne(
      { uuid: winnerId },
      { 
        $set: { globalScore: winnerRating },
        $inc: { voteCount: 1, winCount: 1 }
      }
    ),
    Card.updateOne(
      { uuid: loserId },
      { 
        $set: { globalScore: loserRating },
        $inc: { voteCount: 1 }
      }
    )
  ]);
}

module.exports = {
  insertIntoPersonalRanking,
  getNextComparison,
  updateGlobalRankings
};
