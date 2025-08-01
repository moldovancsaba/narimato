import mongoose from 'mongoose';
import { PLAY_FIELDS, CARD_FIELDS, VOTE_FIELDS } from '../constants/fieldNames';

/**
 * Play Model: Represents an individual game session where a user plays through a specific deck.
 * 
 * Architecture:
 * - sessionId: Browser session (persistent while user is in the app)
 * - deckUuid: Identifies which set of cards (can be reused across plays)  
 * - playUuid: Each individual game/play session (new UUID every time user starts playing a deck)
 * 
 * This ensures proper separation of concerns and prevents mixing of results between different plays.
 */

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

const PlaySchema = new mongoose.Schema({
  // Core identifiers
  [PLAY_FIELDS.UUID]: { type: String, required: true, unique: true, index: true },
  [PLAY_FIELDS.SESSION_ID]: { type: String, required: true, index: true },
  [PLAY_FIELDS.DECK_UUID]: { type: String, required: true, index: true },
  
  // Play state management
  [PLAY_FIELDS.STATUS]: { 
    type: String, 
    enum: ['active', 'idle', 'completed', 'expired'], 
    default: 'active',
    index: true 
  },
  [PLAY_FIELDS.STATE]: {
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
  deck: [{ type: String, ref: 'Card' }], // Array of card UUIDs in this deck
  deckTag: { type: String, required: true }, // Which deck was selected (e.g., 'all', 'react', etc.)
  totalCards: { type: Number, default: 0 },
  
  // Game data
  swipes: [SwipeSchema],
  votes: [VoteSchema],
  personalRanking: [{ type: String }], // Ordered array of card UUIDs
  
  // Timestamps
  [PLAY_FIELDS.CREATED_AT]: { type: Date, default: Date.now, index: true },
  lastActivity: { type: Date, default: Date.now, index: true },
  [PLAY_FIELDS.COMPLETED_AT]: { type: Date, default: null },
  [PLAY_FIELDS.EXPIRES_AT]: { type: Date, required: true }
});

// TTL Index for automatic cleanup
PlaySchema.index({ [PLAY_FIELDS.EXPIRES_AT]: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for efficient queries
PlaySchema.index({ [PLAY_FIELDS.SESSION_ID]: 1, [PLAY_FIELDS.STATUS]: 1 });
PlaySchema.index({ [PLAY_FIELDS.DECK_UUID]: 1, [PLAY_FIELDS.STATUS]: 1 });

// Instance methods
PlaySchema.methods.getRightSwipesCount = function() {
  return this.swipes.filter((s: { [key: string]: string }) => s[VOTE_FIELDS.DIRECTION] === 'right').length;
};

PlaySchema.methods.handleVoteTimeout = function(cardA: string, cardB: string) {
  const randomWinner = Math.random() >= 0.5 ? cardA : cardB;
  this.recordVote(cardA, cardB, randomWinner, true);
};

PlaySchema.methods.getNextComparisonCard = function(currentCard: string): string | null {
  const rankedCards = this.personalRanking;
  
  if (rankedCards.length === 0 || !currentCard) return null;
  
  if (!rankedCards.includes(currentCard)) {
    return rankedCards[rankedCards.length - 1];
  }
  
  const currentIndex = rankedCards.indexOf(currentCard);
  
  if (currentIndex > 0) {
    return rankedCards[currentIndex - 1];
  }
  
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

// Interface definition
export interface IPlay extends mongoose.Document {
  playUuid: string;
  sessionId: string;
  deckUuid: string;
  status: 'active' | 'idle' | 'completed' | 'expired';
  state: 'swiping' | 'voting' | 'comparing' | 'completed';
  version: number;
  deck: string[];
  deckTag: string;
  totalCards: number;
  createdAt: Date;
  lastActivity: Date;
  completedAt: Date | null;
  expiresAt: Date;
  swipes: Array<{
    cardId: string;
    direction: 'left' | 'right';
    timestamp: Date;
  }>;
  votes: Array<{
    cardA: string;
    cardB: string;
    winner: string;
    timestamp: Date;
  }>;
  personalRanking: string[];
  
  // Methods
  getRightSwipesCount(): number;
  handleVoteTimeout(cardA: string, cardB: string): void;
  getNextComparisonCard(currentCard: string): string | null;
}

export const Play = mongoose.models.Play || mongoose.model<IPlay>('Play', PlaySchema);
