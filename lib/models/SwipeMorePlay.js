const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  direction: { type: String, enum: ['left', 'right'], required: true },
  timestamp: { type: Date, default: Date.now }
});

const cardInfoSchema = new mongoose.Schema({
  id: String,
  name: String,
  title: String,
  description: String,
  imageUrl: String,
  isParent: { type: Boolean, default: false },
  hasChildren: { type: Boolean, default: false }
});

const likedCardSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  card: cardInfoSchema,
  swipedAt: { type: Date, default: Date.now },
  rank: { type: Number, required: true }
});

const rejectedCardSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  card: cardInfoSchema,
  swipedAt: { type: Date, default: Date.now }
});

const voteSchema = new mongoose.Schema({
  cardA: { type: String, required: true },
  cardB: { type: String, required: true },
  winner: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const finalRankingSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  card: {
    id: String,
    title: String,
    description: String,
    imageUrl: String
  },
  rank: { type: Number, required: true },
  swipedAt: Date,
  wins: { type: Number, default: 0 },
  totalComparisons: { type: Number, default: 0 }
});

// Schema for a single level in the hierarchical structure
const levelSchema = new mongoose.Schema({
  parentTag: { type: String, required: true }, // The parent tag/context for this level
  cards: [cardInfoSchema], // Cards at this level
  currentCardIndex: { type: Number, default: 0 },
  likedCards: [likedCardSchema],
  rejectedCards: [rejectedCardSchema],
  completed: { type: Boolean, default: false }
});

// Use Mixed type for decision tree to handle complex recursive structure

const swipeMorePlaySchema = new mongoose.Schema({
  uuid: { type: String, required: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true },
  
  // SEQUENTIAL SESSION APPROACH (New SwipeMore mode)
  decisionSequence: [{ type: mongoose.Schema.Types.Mixed }], // Array of decision steps in order
  sequencePosition: { type: Number, default: 0 }, // Current position in the decision sequence
  sequenceComplete: { type: Boolean, default: false }, // Whether all sequence steps are completed
  currentFamilyIndex: { type: Number, default: 0 }, // Which family we're currently processing
  familiesToProcess: [{ // Queue of families to process
    familyTag: String,
    level: Number,
    context: String,
    sessionId: String,
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
    completedAt: Date
  }],
  activeSwipeOnlySession: String, // Current swipe-only session ID
  combinedRanking: [{ type: mongoose.Schema.Types.Mixed }], // Combined results from all family sessions
  allSwipeHistory: [{ // All swipes across all family sessions
    cardId: String,
    direction: { type: String, enum: ['left', 'right'] },
    familyContext: { type: mongoose.Schema.Types.Mixed },
    sessionId: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // DECISION TREE APPROACH (Legacy hierarchical mode)
  decisionTree: { type: mongoose.Schema.Types.Mixed }, // Pre-built complete tree structure
  currentPath: [{ type: String }], // Array of card IDs representing path taken
  currentCardIndex: { type: Number, default: 0 }, // Current position in current level
  attemptedParents: [{ type: String }], // Track parents we've attempted (for infinite loop prevention)
  
  // LEGACY HIERARCHICAL STRUCTURE (for backward compatibility)
  currentLevel: levelSchema, // The level currently being swiped
  levelHistory: [levelSchema], // All completed levels in chronological order
  hierarchicalComplete: { type: Boolean, default: false },
  
  // LEGACY FIELDS (for backward compatibility, but not used in hierarchical mode)
  cards: [{
    id: String,
    title: String,
    description: String,
    imageUrl: String
  }],
  currentCardIndex: { type: Number, default: 0 },
  likedCards: [likedCardSchema],
  rejectedCards: [rejectedCardSchema],
  swipeHistory: [swipeSchema],
  votingPhase: { type: Boolean, default: false },
  votingContext: {
    newCard: String,
    compareWith: String
  },
  votingHistory: [voteSchema],
  
  // FINAL RESULTS
  finalRanking: [finalRankingSchema],
  
  // SESSION STATE
  completed: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
  lastActivity: { type: Date, default: Date.now }
});

// Ensure proper indexing for queries
swipeMorePlaySchema.index({ uuid: 1 });
swipeMorePlaySchema.index({ organizationId: 1 });
swipeMorePlaySchema.index({ status: 1 });

module.exports = mongoose.models.SwipeMorePlay || mongoose.model('SwipeMorePlay', swipeMorePlaySchema);
