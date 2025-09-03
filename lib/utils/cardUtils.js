const Card = require('../models/Card');

// Get all children of a parent hashtag (deck cards)
async function getDeckCards(organizationId, parentTag) {
  return await Card.find({
    organizationId,
    parentTag,
    isActive: true
  }).sort({ globalScore: -1 });
}

// Check if a hashtag is a playable deck (hierarchical OR simple)
async function isDeck(organizationId, hashtag) {
  // Count parent cards (for hierarchical decks like "company")
  const parentCount = await Card.countDocuments({
    organizationId,
    parentTag: hashtag,
    isParent: true,
    isActive: true
  });
  
  if (parentCount >= 2) {
    return true; // Hierarchical deck with 2+ parents
  }
  
  // Count all cards (for simple decks like "0", "1", "2", "3")
  const totalCount = await Card.countDocuments({
    organizationId,
    parentTag: hashtag,
    isActive: true
  });
  
  return totalCount >= 2; // Simple deck with 2+ cards
}

// Get all deck hashtags (cards that have children)
async function getDecks(organizationId) {
  const pipeline = [
    { $match: { organizationId, isActive: true, parentTag: { $exists: true, $ne: null } } },
    { $group: { _id: '$parentTag', count: { $sum: 1 } } },
    { $match: { count: { $gte: 2 } } },
    { $project: { hashtag: '$_id', count: 1, _id: 0 } }
  ];
  
  return await Card.aggregate(pipeline);
}

module.exports = {
  getDeckCards,
  isDeck,
  getDecks
};
