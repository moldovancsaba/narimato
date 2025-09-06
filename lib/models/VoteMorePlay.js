const mongoose = require('mongoose');

// FUNCTIONAL: Vote-More session orchestrator model
// STRATEGIC: Coordinates multiple vote-only segments (families) and aggregates results
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
  combinedRanking: [{
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
  }],

  // History/logging
  decisionSequence: [{
    step: Number,
    type: String,
    familyTag: String,
    level: Number,
    context: String,
    timestamp: { type: Date, default: Date.now }
  }],

  completed: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, {
  timestamps: true
});

voteMorePlaySchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.models.VoteMorePlay || mongoose.model('VoteMorePlay', voteMorePlaySchema);

