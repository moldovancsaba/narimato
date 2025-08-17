import mongoose from 'mongoose';

/**
 * Play Model: Represents an individual game session where a user plays through a specific deck.
 * 
 * STANDARDIZED UUID ARCHITECTURE:
 * - SessionUUID: Browser session (persistent while user is in the app)
 * - DeckUUID: Identifies which set of cards (can be reused across plays)  
 * - PlayUUID: Each individual game/play session (new UUID every time user starts playing a deck)
 * 
 * This ensures proper separation of concerns and prevents mixing of results between different plays.
 * All UUID fields use the standard naming convention - NO aliases allowed.
 */

const SwipeSchema = new mongoose.Schema({
  uuid: { type: String, required: true },
  direction: { type: String, enum: ['left', 'right'], required: true },
  timestamp: { type: Date, default: Date.now }
});

const VoteSchema = new mongoose.Schema({
  cardA: { type: String, required: true },
  cardB: { type: String, required: true },
  winner: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const PlaySchema = new mongoose.Schema({
  // Primary UUID identifiers
  uuid: { type: String, required: true, unique: true, index: true },
  sessionUUID: { type: String, required: true, index: true },
  deckUUID: { type: String, required: true, index: true },
  
  // Organization context for robust multi-tenant support
  organizationUUID: { type: String, required: true, index: true },
  
  // Play state management
  status: { 
    type: String, 
    enum: ['active', 'idle', 'completed', 'expired'], 
    default: 'active',
    index: true 
  },
  state: {
    type: String,
    enum: ['swiping', 'voting', 'comparing', 'completed'],
    default: 'swiping',
    index: true
  },
  
  // Version control for optimistic locking
  version: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Deck and card data
  deck: [{ type: String, ref: 'Card' }], // Array of CardUUIDs in this deck
  deckTag: { type: String, required: true }, // Which deck was selected (e.g., 'all', 'react', etc.)
  totalCards: { type: Number, default: 0 },
  
  // Game data
  swipes: [SwipeSchema],
  votes: [VoteSchema],
  personalRanking: [{ type: String }], // Ordered array of CardUUIDs
  currentPair: {
    cardA: {
      uuid: String,
      name: String,
      body: {
        textContent: String,
        imageUrl: String,
        background: mongoose.Schema.Types.Mixed // Support both string and object formats
      }
    },
    cardB: {
      uuid: String,
      name: String,
      body: {
        textContent: String,
        imageUrl: String,
        background: mongoose.Schema.Types.Mixed // Support both string and object formats
      }
    }
  }, // Current comparison pair for voting state
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  lastActivity: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true }
});

// TTL Index for automatic cleanup
PlaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for efficient queries
PlaySchema.index({ sessionUUID: 1, status: 1 });
PlaySchema.index({ deckUUID: 1, status: 1 });

// Instance methods
PlaySchema.methods.getRightSwipesCount = function() {
  return this.swipes.filter((s: { direction: string }) => s.direction === 'right').length;
};

PlaySchema.methods.handleVoteTimeout = function(cardA: string, cardB: string) {
  const randomWinner = Math.random() >= 0.5 ? cardA : cardB;
  this.recordVote(cardA, cardB, randomWinner, true);
};

PlaySchema.methods.getNextComparisonCard = function(currentCard: string): string | null {
  const rankedCards = this.personalRanking;
  
  if (rankedCards.length === 0 || !currentCard) return null;
  
  // FUNCTIONAL: Get all card pairs that have already been voted on in this session
  // STRATEGIC: Prevent showing the same two cards for voting more than once
  const votedPairs = new Set();
  this.votes.forEach((vote: any) => {
    // Create normalized pair keys (sorted to handle A vs B and B vs A the same)
    const pair = [vote.cardA, vote.cardB].sort().join('|');
    votedPairs.add(pair);
  });
  
  console.log(`🔍 Session has ${votedPairs.size} voted pairs:`, Array.from(votedPairs));
  
  // FUNCTIONAL: Helper function to check if two cards have already been compared
  // STRATEGIC: Ensures we never show a duplicate comparison in the same session
  const havePairBeenVoted = (cardA: string, cardB: string): boolean => {
    const pairKey = [cardA, cardB].sort().join('|');
    const hasBeenVoted = votedPairs.has(pairKey);
    if (hasBeenVoted) {
      console.log(`🚫 Cards ${cardA.substring(0,8)} and ${cardB.substring(0,8)} have already been compared`);
    }
    return hasBeenVoted;
  };
  
  if (!rankedCards.includes(currentCard)) {
    // Card is not in ranking yet - find the first ranked card that hasn't been compared
    for (let i = rankedCards.length - 1; i >= 0; i--) {
      const candidateCard = rankedCards[i];
      if (!havePairBeenVoted(currentCard, candidateCard)) {
        console.log(`✅ Found new comparison: ${currentCard.substring(0,8)} vs ${candidateCard.substring(0,8)} (new card vs ranked)`);
        return candidateCard;
      }
    }
    console.log(`⚠️ No available comparisons found for new card ${currentCard.substring(0,8)}`);
    return null;
  }
  
  // Card is already in ranking - use binary search strategy
  // Find cards that haven't been compared yet for binary search positioning
  const currentIndex = rankedCards.indexOf(currentCard);
  
  // Try cards in order based on binary search strategy (middle-out approach)
  const searchCandidates = [];
  
  // Add cards before current position (higher ranking)
  for (let i = currentIndex - 1; i >= 0; i--) {
    searchCandidates.push(rankedCards[i]);
  }
  
  // Add cards after current position (lower ranking)
  for (let i = currentIndex + 1; i < rankedCards.length; i++) {
    searchCandidates.push(rankedCards[i]);
  }
  
  // Find the first candidate that hasn't been compared yet
  for (const candidateCard of searchCandidates) {
    if (!havePairBeenVoted(currentCard, candidateCard)) {
      console.log(`✅ Found new comparison: ${currentCard.substring(0,8)} vs ${candidateCard.substring(0,8)} (binary search)`);
      return candidateCard;
    }
  }
  
  console.log(`⚠️ No more available comparisons for card ${currentCard.substring(0,8)} - all possible pairs have been voted`);
  return null;
};

// Pre-save hook to update lastActivity
PlaySchema.pre('save', function(next) {
  if (this.isModified()) {
    this.lastActivity = new Date();
    this.version += 1;
  }
  next();
});

// Transform timestamps to ISO8601 in JSON output
PlaySchema.set('toJSON', {
  transform: function(doc, ret: any) {
    if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
    if (ret.lastActivity instanceof Date) ret.lastActivity = ret.lastActivity.toISOString();
    if (ret.completedAt instanceof Date) ret.completedAt = ret.completedAt.toISOString();
    if (ret.expiresAt instanceof Date) ret.expiresAt = ret.expiresAt.toISOString();
    
    if (ret.swipes) {
      ret.swipes.forEach((swipe: any) => {
        if (swipe.timestamp instanceof Date) swipe.timestamp = swipe.timestamp.toISOString();
      });
    }
    if (ret.votes) {
      ret.votes.forEach((vote: any) => {
        if (vote.timestamp instanceof Date) vote.timestamp = vote.timestamp.toISOString();
      });
    }
    return ret;
  }
});

// Optimistic locking middleware
PlaySchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as mongoose.UpdateQuery<typeof this>;
  if (update) {
    if (!update.$inc) {
      update.$inc = { version: 1 };
    } else if (typeof update.$inc.version === 'undefined') {
      update.$inc.version = 1;
    }
    
    if (!update.$set) {
      update.$set = { lastActivity: new Date() };
    } else {
      update.$set.lastActivity = new Date();
    }
  }
  next();
});

// Enhanced error handling for optimistic locking
PlaySchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'VersionError' || error.code === 11000) {
    const rollbackError = new Error('Concurrent modification detected. Operation rolled back. Please refresh and retry.');
    rollbackError.name = 'OptimisticLockError';
    next(rollbackError);
  } else {
    next(error);
  }
});

PlaySchema.post('findOneAndUpdate', function(error: any, doc: any, next: any) {
  if (error && (error.name === 'VersionError' || error.code === 11000)) {
    const rollbackError = new Error('Update failed due to concurrent modification. Please retry with fresh data.');
    rollbackError.name = 'ConcurrentUpdateError';
    next(rollbackError);
  } else {
    next(error);
  }
});

// Clean interface matching actual schema fields
export interface IPlay extends mongoose.Document {
  uuid: string;            // Primary identifier for this play session
  sessionUUID: string;     // Browser session identifier
  deckUUID: string;        // Deck identifier
  organizationUUID: string; // Organization context for multi-tenant support
  status: 'active' | 'idle' | 'completed' | 'expired';
  state: 'swiping' | 'voting' | 'comparing' | 'completed';
  version: number;
  deck: string[];          // Array of card UUIDs in this deck
  deckTag: string;
  totalCards: number;
  createdAt: Date;
  lastActivity: Date;
  completedAt: Date | null;
  expiresAt: Date;
  swipes: Array<{
    uuid: string;          // Card UUID
    direction: 'left' | 'right';
    timestamp: Date;
  }>;
  votes: Array<{
    cardA: string;
    cardB: string;
    winner: string;
    timestamp: Date;
  }>;
  personalRanking: string[];   // Array of card UUIDs
  currentPair?: {
    cardA: {
      uuid: string;
      name: string;
      body: {
        textContent?: string;
        imageUrl?: string;
        background?: any; // Support both string and object formats
      }
    };
    cardB: {
      uuid: string;
      name: string;
      body: {
        textContent?: string;
        imageUrl?: string;
        background?: any; // Support both string and object formats
      }
    }
  }; // Current comparison pair for voting state
  
  // Methods
  getRightSwipesCount(): number;
  handleVoteTimeout(cardA: string, cardB: string): void;
  getNextComparisonCard(currentCard: string): string | null;
}

export const Play = mongoose.models.Play || mongoose.model<IPlay>('Play', PlaySchema);
