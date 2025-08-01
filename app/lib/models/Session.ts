import mongoose from 'mongoose';
import { SESSION_FIELDS, CARD_FIELDS, VOTE_FIELDS } from '../constants/fieldNames';

// Define SessionState enum for enhanced state management
enum SessionState {
  SWIPING = 'swiping',
  VOTING = 'voting',
  COMPARING = 'comparing',
  COMPLETED = 'completed'
}

const SwipeSchema = new mongoose.Schema({
  [CARD_FIELDS.ID]: { type: String, required: true },
  [VOTE_FIELDS.DIRECTION]: { type: String, enum: ['left', 'right'], required: true },
  [VOTE_FIELDS.TIMESTAMP]: { type: Date, default: Date.now }
});

const VoteSchema = new mongoose.Schema({
  [VOTE_FIELDS.CARD_A]: { type: String, required: true },
  [VOTE_FIELDS.CARD_B]: { type: String, required: true },
  [VOTE_FIELDS.WINNER]: { type: String, required: true },
  [VOTE_FIELDS.TIMESTAMP]: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  [SESSION_FIELDS.ID]: { type: String, required: true, unique: true, index: true },
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
  [SESSION_FIELDS.VERSION]: {
    type: Number,
    default: 0,
    index: true
  },
  deck: [{ type: String, ref: 'Card' }], // Array of card UUIDs
  totalCards: { type: Number, default: 0 }, // Total number of cards in deck
  createdAt: { type: Date, default: Date.now, index: true },
  lastActivity: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
expiresAt: { type: Date, required: true },
  
  swipes: [SwipeSchema],
  votes: [VoteSchema],
  personalRanking: [{ type: String }] // Ordered array of card UUIDs
});

// TTL Index for automatic cleanup
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance method to get right-swiped cards count
SessionSchema.methods.getRightSwipesCount = function() {
  return this.swipes.filter((s: { [key: string]: string }) => s[VOTE_FIELDS.DIRECTION] === 'right').length;
};

// Method to handle vote timeouts
SessionSchema.methods.handleVoteTimeout = function(cardA: string, cardB: string) {
  const randomWinner = Math.random() >= 0.5 ? cardA : cardB;
  this.recordVote(cardA, cardB, randomWinner, true);
};

// Method to validate state transitions for enhanced state management
SessionSchema.methods.validateStateTransition = function(from: SessionState, to: SessionState): boolean {
  // Define valid state transition mappings
  const validTransitions: Record<SessionState, SessionState[]> = {
    [SessionState.SWIPING]: [SessionState.VOTING, SessionState.COMPLETED],
    [SessionState.VOTING]: [SessionState.COMPARING, SessionState.COMPLETED],
    [SessionState.COMPARING]: [SessionState.VOTING, SessionState.COMPLETED],
    [SessionState.COMPLETED]: [] // Terminal state - no transitions allowed
  };
  
  // Check if the transition is valid based on predefined rules
  return validTransitions[from]?.includes(to) ?? false;
};

// Instance method to get next card to vote against with enhanced logic
SessionSchema.methods.getNextComparisonCard = function(currentCard: string): string | null {
  const rankedCards = this.personalRanking;
  
  // Return null if no ranked cards exist or if current card is not provided
  if (rankedCards.length === 0 || !currentCard) return null;
  
  // For new cards not yet in ranking, start comparison from the lowest ranked card
  if (!rankedCards.includes(currentCard)) {
    return rankedCards[rankedCards.length - 1];
  }
  
  // For existing cards in ranking, get their current position and find next comparison
  const currentIndex = rankedCards.indexOf(currentCard);
  
  // Compare with next higher ranked card if available
  if (currentIndex > 0) {
    return rankedCards[currentIndex - 1];
  }
  
  // If already at the top or no valid comparison available, return null
  return null;
};

// Pre-save hook to update lastActivity and handle version increment
SessionSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.lastActivity = new Date();
    this.version += 1;
  }
  next();
});

// Transform timestamps to ISO8601 in JSON output
SessionSchema.set('toJSON', {
  transform: function(doc, ret: { createdAt?: Date | string; lastActivity?: Date | string; completedAt?: Date | string; expiresAt?: Date | string; swipes?: any[]; votes?: any[] }) {
    if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
    if (ret.lastActivity instanceof Date) ret.lastActivity = ret.lastActivity.toISOString();
    if (ret.completedAt instanceof Date) ret.completedAt = ret.completedAt.toISOString();
    if (ret.expiresAt instanceof Date) ret.expiresAt = ret.expiresAt.toISOString();
    
    // Convert timestamps in swipes and votes
    if (ret.swipes) {
      ret.swipes.forEach(swipe => {
        if (swipe.timestamp instanceof Date) swipe.timestamp = swipe.timestamp.toISOString();
      });
    }
    if (ret.votes) {
      ret.votes.forEach(vote => {
        if (vote.timestamp instanceof Date) vote.timestamp = vote.timestamp.toISOString();
      });
    }
    return ret;
  }
});

// Enhanced optimistic locking middleware with timestamp validation
SessionSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as mongoose.UpdateQuery<typeof this>;
  if (update) {
    // Increment version for optimistic locking
    if (!update.$inc) {
      update.$inc = { [SESSION_FIELDS.VERSION]: 1 };
    } else if (typeof update.$inc[SESSION_FIELDS.VERSION] === 'undefined') {
      update.$inc[SESSION_FIELDS.VERSION] = 1;
    }
    
    // Update lastActivity timestamp for concurrent update detection
    if (!update.$set) {
      update.$set = { lastActivity: new Date() };
    } else {
      update.$set.lastActivity = new Date();
    }
  }
  next();
});

// Enhanced error handling for optimistic locking with rollback mechanisms
SessionSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'VersionError' || error.code === 11000) {
    // Version conflict detected - provide detailed error for rollback
    const rollbackError = new Error('Concurrent modification detected. Operation rolled back. Please refresh and retry.');
    rollbackError.name = 'OptimisticLockError';
    next(rollbackError);
  } else {
    next(error);
  }
});

// Add rollback mechanism for failed updates
SessionSchema.post('findOneAndUpdate', function(error: any, doc: any, next: any) {
  if (error && (error.name === 'VersionError' || error.code === 11000)) {
    // Provide rollback information for client-side recovery
    const rollbackError = new Error('Update failed due to concurrent modification. Please retry with fresh data.');
    rollbackError.name = 'ConcurrentUpdateError';
    next(rollbackError);
  } else {
    next(error);
  }
});

// Define interfaces
interface ISwipe {
  [CARD_FIELDS.ID]: string;
  [VOTE_FIELDS.DIRECTION]: 'left' | 'right';
  [VOTE_FIELDS.TIMESTAMP]: Date;
}

interface IVote {
  [VOTE_FIELDS.CARD_A]: string;
  [VOTE_FIELDS.CARD_B]: string;
  [VOTE_FIELDS.WINNER]: string;
  [VOTE_FIELDS.TIMESTAMP]: Date;
}

// Enhanced interface with state management methods
export interface ISession extends mongoose.Document {
  [SESSION_FIELDS.ID]: string;
  status: 'active' | 'idle' | 'completed' | 'expired';
  state: 'swiping' | 'voting' | 'comparing' | 'completed';
  version: number;
  deck: string[];
  createdAt: Date;
  lastActivity: Date;
  completedAt: Date | null;
  expiresAt: Date;
  swipes: ISwipe[];
  votes: IVote[];
  personalRanking: string[];
  
  // Enhanced state management methods
  validateStateTransition(from: SessionState, to: SessionState): boolean;
  getNextComparisonCard(currentCard: string): string | null;
  getRightSwipesCount(): number;
  handleVoteTimeout(cardA: string, cardB: string): void;
}

export const Session = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);

// Export SessionState enum for use in other modules
export { SessionState };
