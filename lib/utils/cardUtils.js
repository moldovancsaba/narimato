const Card = require('../models/Card');

// Get all children of a parent hashtag (deck cards)
async function getDeckCards(organizationId, parentTag) {
  return await Card.find({
    organizationId,
    parentTag,
    isActive: true
  }).sort({ globalScore: -1 });
}

// Check if a hashtag has children (is a playable deck)
async function isDeck(organizationId, hashtag) {
  const count = await Card.countDocuments({
    organizationId,
    parentTag: hashtag,
    isActive: true
  });
  return count >= 2; // Need at least 2 cards to play
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
