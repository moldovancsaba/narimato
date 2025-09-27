const mongoose = require('mongoose');

// FUNCTIONAL: Rank-Only orchestration model
// STRATEGIC: Two-phase play (swipe-only → vote-only) with minimal state tracking
const rankOnlyPlaySchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true },

  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  phase: { type: String, enum: ['swipe', 'vote', 'completed'], default: 'swipe' },

  // Segment sessions
  swipeSessionId: { type: String }, // SwipeOnlyPlay.uuid
  voteSessionId: { type: String },  // Play(uuid, mode=vote_only)

  // Data passed from swipe to vote
  likedCardIds: [String],

  // Final outcome (used when fewer than 2 liked cards)
  finalRanking: [String],

  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
}, {
  timestamps: true
});

rankOnlyPlaySchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.models.RankOnlyPlay || mongoose.model('RankOnlyPlay', rankOnlyPlaySchema);

