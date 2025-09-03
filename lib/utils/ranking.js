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

// Family-aware ranking functions
async function getFamilyInfo(cardId) {
  const Card = require('../models/Card');
  const card = await Card.findOne({ uuid: cardId });
  if (!card) return null;
  
  if (card.isParent) {
    return { family: card.name, isParent: true };
  } else if (card.parentTag) {
    return { family: card.parentTag, isParent: false };
  } else {
    return { family: 'root', isParent: false };
  }
}

// Family-aware version that ensures cards only compare within same family
async function getFamilyAwareNextComparison(personalRanking, newCardId, allVotes = []) {
  if (personalRanking.length === 0) return null;
  if (personalRanking.includes(newCardId)) return null;
  
  // Get family info for the new card
  const newCardFamily = await getFamilyInfo(newCardId);
  if (!newCardFamily) return null;
  
  console.log(`🏠 Family check: newCard ${newCardId} belongs to family "${newCardFamily.family}", isParent: ${newCardFamily.isParent}`);
  
  // Get family info for all cards in current ranking
  const rankingFamilies = await Promise.all(
    personalRanking.map(async cardId => {
      const family = await getFamilyInfo(cardId);
      return { cardId, family: family?.family, isParent: family?.isParent };
    })
  );
  
  // Filter ranking to only cards from same family
  const sameFamilyCards = rankingFamilies.filter(card => 
    card.family === newCardFamily.family
  );
  
  console.log(`👨‍👩‍👧‍👦 Same family cards for "${newCardFamily.family}": ${sameFamilyCards.length}/${personalRanking.length}`);
  
  if (sameFamilyCards.length === 0) {
    // No cards from same family in ranking yet - card will be first in its family
    console.log(`🆕 First card from family "${newCardFamily.family}" - no comparison needed`);
    return null;
  }
  
  // Create family-filtered ranking preserving order
  const familyRanking = sameFamilyCards.map(card => card.cardId);
  
  // Calculate bounds using only family-specific votes
  const familyVotes = allVotes.filter(vote => {
    return familyRanking.includes(vote.cardA) && familyRanking.includes(vote.cardB) && 
           (vote.cardA === newCardId || vote.cardB === newCardId);
  });
  
  console.log(`🗳️ Family-filtered votes: ${familyVotes.length}/${allVotes.length}`);
  
  const bounds = calculateAccumulatedSearchBounds(newCardId, familyRanking, familyVotes);
  
  // If search space has collapsed within family, no comparison needed
  if (bounds.start >= bounds.end) {
    console.log(`✅ Family search space collapsed for ${newCardId}: [${bounds.start}, ${bounds.end})`); 
    return null;
  }
  
  // Find middle card in family search space
  const middleIndex = Math.floor((bounds.start + bounds.end) / 2);
  
  if (middleIndex >= familyRanking.length) {
    console.log(`⚠️ Middle index ${middleIndex} exceeds family ranking length ${familyRanking.length}`);
    return null;
  }
  
  const candidateCard = familyRanking[middleIndex];
  
  // Check if we've already compared against this card
  const alreadyCompared = familyVotes.some(vote => 
    (vote.cardA === newCardId && vote.cardB === candidateCard) ||
    (vote.cardB === newCardId && vote.cardA === candidateCard)
  );
  
  if (alreadyCompared) {
    console.log(`🔄 Already compared ${newCardId} vs ${candidateCard} in family "${newCardFamily.family}"`);
    return null;
  }
  
  console.log(`🏠 Family comparison: ${newCardId} vs ${candidateCard} (family: "${newCardFamily.family}")`);
  return candidateCard;
}

// Family-aware insertion that maintains family groupings
async function insertIntoFamilyAwareRanking(ranking, newCardId, winner, cardA, cardB, allVotes = []) {
  if (ranking.length === 0) {
    return [newCardId];
  }
  
  // Get family info
  const newCardFamily = await getFamilyInfo(newCardId);
  if (!newCardFamily) return ranking;
  
  // Get all family cards already in ranking
  const rankingFamilies = await Promise.all(
    ranking.map(async cardId => {
      const family = await getFamilyInfo(cardId);
      return { cardId, family: family?.family, isParent: family?.isParent };
    })
  );
  
  const sameFamilyCards = rankingFamilies.filter(card => 
    card.family === newCardFamily.family
  );
  
  if (sameFamilyCards.length === 0) {
    // First card from this family - determine insertion point
    if (newCardFamily.isParent) {
      // Parent cards go at the beginning
      const newRanking = [newCardId, ...ranking];
      console.log(`🎯 Inserted parent ${newCardId} at beginning of ranking`);
      return newRanking;
    } else {
      // Child cards go after their parent (if parent exists in ranking)
      const parentIndex = ranking.findIndex(cardId => {
        const card = rankingFamilies.find(f => f.cardId === cardId);
        return card && card.family === 'root' && card.isParent; // Find parent
      });
      
      if (parentIndex !== -1) {
        const newRanking = [...ranking];
        newRanking.splice(parentIndex + 1, 0, newCardId);
        console.log(`🎯 Inserted child ${newCardId} after parent at index ${parentIndex + 1}`);
        return newRanking;
      } else {
        // No parent in ranking, add at end
        const newRanking = [...ranking, newCardId];
        console.log(`🎯 Inserted orphan child ${newCardId} at end of ranking`);
        return newRanking;
      }
    }
  }
  
  // Use regular binary search logic but only within family
  return insertIntoPersonalRanking(ranking, newCardId, winner, cardA, cardB, allVotes);
}

module.exports = {
  insertIntoPersonalRanking,
  getNextComparison,
  updateGlobalRankings,
  getFamilyAwareNextComparison,
  insertIntoFamilyAwareRanking,
  getFamilyInfo
};
