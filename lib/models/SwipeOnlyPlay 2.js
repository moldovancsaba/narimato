const mongoose = require('mongoose');

// FUNCTIONAL: Schema for individual swipe actions
// STRATEGIC: Simple recording of user swipe decisions for later analysis
const swipeSchema = new mongoose.Schema({
  cardId: { type: String, required: true },
  direction: { type: String, enum: ['left', 'right'], required: true }, // left = reject, right = like
  timestamp: { type: Date, default: Date.now }
});

// FUNCTIONAL: Complete schema for SwipeOnly play sessions
// STRATEGIC: Clean, minimal model focused purely on swipe-based ranking without voting complexity
const swipeOnlyPlaySchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  deckTag: { type: String, required: true },
  
  // FUNCTIONAL: Session state management
  // STRATEGIC: Simple status tracking for swipe-only flow
  status: { 
    type: String, 
    enum: ['active', 'completed', 'expired'], 
    default: 'active',
    index: true
  },
  
  // FUNCTIONAL: Cards and user interactions
  // STRATEGIC: Store all cards available for swiping and user swipe decisions
  cardIds: [String], // All cards in this deck
  swipes: [swipeSchema], // User swipe actions
  
  // FUNCTIONAL: Ranking based on swipe order and preference
  // STRATEGIC: Simple ranking: liked cards ordered by swipe timestamp (first liked = top rank)
  likedCards: [{ // Cards swiped right, in order of preference
    cardId: String,
    swipedAt: { type: Date, default: Date.now },
    rank: { type: Number } // 1 = highest preference
  }],
  rejectedCards: [String], // Cards swiped left
  
  // FUNCTIONAL: Variant flag for onboarding mutation (right-only)
  // STRATEGIC: Reuse SwipeOnly model while enabling server-side enforcement of right-only swipes
  isOnboarding: { type: Boolean, default: false },
  
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
// STRATEGIC: Optimize common lookup patterns for swipe-only sessions
swipeOnlyPlaySchema.index({ organizationId: 1, status: 1 });
swipeOnlyPlaySchema.index({ status: 1, lastActivity: -1 });

// FUNCTIONAL: TTL index for automatic session cleanup
// STRATEGIC: Prevent database bloat from expired sessions
swipeOnlyPlaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.SwipeOnlyPlay || mongoose.model('SwipeOnlyPlay', swipeOnlyPlaySchema);
