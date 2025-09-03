const mongoose = require('mongoose');

// FUNCTIONAL: Schema for individual vote comparisons
// STRATEGIC: Recording pairwise comparisons to build ranking through tournament-style voting
const voteComparisonSchema = new mongoose.Schema({
  cardA: { type: String, required: true },
  cardB: { type: String, required: true },
  winner: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// FUNCTIONAL: Complete schema for VoteOnly play sessions  
// STRATEGIC: Clean model focused purely on comparison-based ranking without swiping complexity
const voteOnlyPlaySchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true },
  
  // FUNCTIONAL: Session state management
  // STRATEGIC: Simple status tracking for vote-only flow
  status: { 
    type: String, 
    enum: ['active', 'completed', 'expired'], 
    default: 'active',
    index: true
  },
  
  // FUNCTIONAL: Cards and comparison data
  // STRATEGIC: Store all cards and track comparison results for ranking algorithm
  cardIds: [String], // All cards in this deck
  comparisons: [voteComparisonSchema], // Pairwise comparison results
  
  // FUNCTIONAL: Current comparison state
  // STRATEGIC: Track which comparison is currently being shown to user
  currentComparison: {
    cardA: String,
    cardB: String,
    active: { type: Boolean, default: false }
  },
  
  // FUNCTIONAL: Ranking built from comparison results
  // STRATEGIC: Final ranking derived from tournament-style comparisons
  finalRanking: [{ 
    cardId: String,
    rank: { type: Number }, // 1 = highest preference
    wins: { type: Number, default: 0 }, // Number of comparisons won
    comparisons: { type: Number, default: 0 } // Total comparisons participated in
  }],
  
  // FUNCTIONAL: Algorithm state tracking
  // STRATEGIC: Keep track of comparison algorithm progress and efficiency
  algorithmState: {
    totalComparisonsNeeded: { type: Number, default: 0 },
    comparisonsCompleted: { type: Number, default: 0 },
    phase: { type: String, enum: ['tournament', 'ranking', 'completed'], default: 'tournament' }
  },
  
  // FUNCTIONAL: Session metadata for tracking and cleanup
  // STRATEGIC: Standard session management fields
  createdAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
  lastActivity: { type: Date, default: Date.now },
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}, {
  timestamps: true
});

// FUNCTIONAL: Performance indexes for efficient queries
// STRATEGIC: Optimize common lookup patterns for vote-only sessions
voteOnlyPlaySchema.index({ organizationId: 1, status: 1 });
voteOnlyPlaySchema.index({ status: 1, lastActivity: -1 });
voteOnlyPlaySchema.index({ 'currentComparison.active': 1 });

// FUNCTIONAL: TTL index for automatic session cleanup
// STRATEGIC: Prevent database bloat from expired sessions
voteOnlyPlaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.VoteOnlyPlay || mongoose.model('VoteOnlyPlay', voteOnlyPlaySchema);
