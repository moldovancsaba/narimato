const mongoose = require('mongoose');

// FUNCTIONAL: Vote-More session orchestrator model
// STRATEGIC: Coordinates multiple vote-only segments (families) and aggregates results

// FUNCTIONAL: Subdocument schema for decision steps (note: explicit Schema to allow a field named "type")
// STRATEGIC: Avoids Mongoose interpreting a top-level "type" as the array's type
const decisionStepSchema = new mongoose.Schema({
  step: Number,
  type: String,
  familyTag: String,
  level: Number,
  context: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

// FUNCTIONAL: Subdocument schema for combined ranking entries
// STRATEGIC: Structured aggregated results for UI and analysis
const combinedRankingItemSchema = new mongoose.Schema({
  rank: Number,
  card: {
    id: String,
    title: String,
    description: String,
    imageUrl: String
  },
  familyLevel: Number,
  familyContext: String,
  familyTag: String,
  overallRank: Number,
  familyRank: Number
}, { _id: false });

const voteMorePlaySchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true },

  // Families queue and tracking
  familiesToProcess: [{
    familyTag: String,
    level: Number,
    context: String,
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
    sessionId: String,
    startedAt: Date,
    completedAt: Date
  }],
  currentFamilyIndex: { type: Number, default: 0 },

  // Active vote-only segment
  activeVoteOnlySession: { type: String, default: null },

  // Aggregated outcome
  combinedRanking: [combinedRankingItemSchema],

  // History/logging
  decisionSequence: [decisionStepSchema],

  completed: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, {
  timestamps: true
});

voteMorePlaySchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.models.VoteMorePlay || mongoose.model('VoteMorePlay', voteMorePlaySchema);

