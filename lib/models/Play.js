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
  status: { type: String, enum: ['active', 'completed', 'waiting_for_children', 'hierarchically_completed'], default: 'active' },
  state: { type: String, enum: ['swiping', 'voting', 'child_session'], default: 'swiping' },
  
  // Cards and actions
  cardIds: [String], // All cards in this deck
  swipes: [swipeSchema],
  votes: [voteSchema],
  
  // Personal ranking (ordered by preference)
  personalRanking: [String], // Card IDs in order of preference (best first)
  
  // Child session fields
  parentCardId: { type: String }, // If this is a child session, the parent card ID
  parentCardName: { type: String }, // Parent card name for reference
  
  // Family sessions tracking (legacy)
  familySessions: [{
    parentCardId: String,
    parentName: String,
    parentTitle: String,
    childrenCount: Number,
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' }
  }],
  
  // Interactive hierarchical session fields
  hierarchicalPhase: { type: String, enum: ['parents', 'children'], default: undefined }, // Current phase
  parentSessionId: { type: String }, // For child sessions - reference to parent
  currentParentId: { type: String }, // For child sessions - which parent we're ranking
  currentParentName: { type: String }, // For child sessions - parent name
  parentRankPosition: { type: Number }, // For child sessions - parent's position in ranking
  currentChildSession: { type: String }, // For parent sessions - active child session ID
  childSessions: [{ // Track child sessions for parent
    parentId: String,
    parentName: String,
    sessionId: String,
    status: { type: String, enum: ['active', 'completed', 'skipped'], default: 'active' },
    childCount: Number,
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    childRanking: [String],
    reason: String // For skipped sessions
  }],
  hierarchicalRanking: [String], // Final hierarchical ranking
  hierarchicalDetails: [{ // Details about the final ranking
    parentId: String,
    parentPosition: Number,
    type: { type: String, enum: ['parent_with_children', 'parent_only'] },
    childCount: Number,
    childIds: [String]
  }],
  
  // FUNCTIONAL: Hierarchical decision tree session data
  // STRATEGIC: Track parent card decisions and child session states for decision tree logic
  hierarchicalData: {
    enabled: { type: Boolean, default: false }, // True if this is a hierarchical session
    parentDecisions: { type: Map, of: {
      direction: { type: String, enum: ['left', 'right'] },
      timestamp: { type: Date, default: Date.now },
      childrenCount: { type: Number, default: 0 },
      decision: { type: String, enum: ['include_children', 'exclude_children', 'no_children'] }
    }}, // parentCardId -> decision data
    currentChildSession: {
      active: { type: Boolean, default: false },
      parentCardId: { type: String },
      childCards: [String], // Child card IDs in current mini-session
      childRanking: [String], // Current ranking of children
      childVotes: [voteSchema] // Votes specific to child session
    },
    excludedCards: [String], // Cards excluded due to parent left swipes
    childSessionHistory: [{ // History of completed child sessions
      parentCardId: String,
      childCards: [String],
      finalRanking: [String],
      completedAt: { type: Date, default: Date.now }
    }]
  },
  
  // Metadata
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } // 24h
}, {
  timestamps: true
});

playSchema.index({ organizationId: 1, status: 1 });
playSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Play || mongoose.model('Play', playSchema);
