const mongoose = require('mongoose');

// FUNCTIONAL: Rank-More orchestration model for hierarchical, multi-level ranking
// STRATEGIC: Coordinates iterative Rank-Only sub-sessions across families/levels
const familySchema = new mongoose.Schema({
  parentId: { type: String, required: true }, // UUID of the parent card
  parentName: { type: String, required: true }, // Card.name used as familyTag (children parentTag)
  familyTag: { type: String, required: true }, // Alias for parentName to start child sessions
  level: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  sessionId: { type: String }, // Active Rank-Only sub-session UUID
  startedAt: { type: Date },
  completedAt: { type: Date }
});

const perFamilyResultSchema = new mongoose.Schema({
  parentId: { type: String, required: true },
  parentName: { type: String, required: true },
  ranking: [String] // Ordered child card UUIDs (liked only)
});

const rankMorePlaySchema = new mongoose.Schema({
  // Identity
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true },

  // Session state
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  phase: { type: String, enum: ['roots_swipe', 'roots_vote', 'family', 'completed'], default: 'roots_swipe' },
  currentLevel: { type: Number, default: 0 },

  // Root level results
  rankedRoots: [String], // Ordered list of root UUIDs (liked roots only)

  // Active sub-session
  activeRankOnlySession: { type: String }, // RankOnlyPlay.uuid when active
  activeParentId: { type: String },
  activeParentName: { type: String },

  // Families orchestration
  pendingFamilies: [familySchema], // Families to process in current or future levels (shuffled per level)
  currentFamilyIndex: { type: Number, default: 0 },

  // Aggregation
  perFamilyResults: [perFamilyResultSchema],
  finalOrder: [String], // Flattened final order (parent followed by ranked descendants)

  // Metadata
  rngSeed: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, {
  timestamps: true
});

rankMorePlaySchema.index({ organizationId: 1, status: 1 });
rankMorePlaySchema.index({ status: 1, currentLevel: 1 });

module.exports = mongoose.models.RankMorePlay || mongoose.model('RankMorePlay', rankMorePlaySchema);
