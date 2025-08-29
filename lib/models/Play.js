const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  cardId: String,
  direction: { type: String, enum: ['left', 'right'] }, // left = dislike, right = like
  timestamp: { type: Date, default: Date.now }
});

const voteSchema = new mongoose.Schema({
  cardA: String,
  cardB: String,
  winner: String, // cardA or cardB
  timestamp: { type: Date, default: Date.now }
});

const playSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true }, // The parent #hashtag being played
  
  // Session state
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  state: { type: String, enum: ['swiping', 'voting'], default: 'swiping' },
  
  // Cards and actions
  cardIds: [String], // All cards in this deck
  swipes: [swipeSchema],
  votes: [voteSchema],
  
  // Personal ranking (ordered by preference)
  personalRanking: [String], // Card IDs in order of preference (best first)
  
  // Metadata
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } // 24h
}, {
  timestamps: true
});

playSchema.index({ organizationId: 1, status: 1 });
playSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Play || mongoose.model('Play', playSchema);
