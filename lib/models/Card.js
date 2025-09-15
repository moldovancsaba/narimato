const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  name: { type: String, required: true }, // The #hashtag name
  title: { type: String, required: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  hashtags: [String], // Array of hashtags including the parent
  isActive: { type: Boolean, default: true },
  
  // Hierarchy
  parentTag: { type: String }, // The parent #hashtag (null for root cards)
  
  // FUNCTIONAL: Hierarchical decision tree control fields
  // STRATEGIC: Enable parent cards to control child card inclusion in ranking sessions
  isParent: { type: Boolean, default: false }, // True if this card has children
  hasChildren: { type: Boolean, default: false }, // Computed field for quick queries
  childrenPlayMode: { 
    type: String, 
    enum: ['conditional', 'always', 'never'], 
    default: 'conditional' 
    // 'conditional': Children play only if parent swiped right
    // 'always': Children always included regardless of parent decision
    // 'never': Children never play (parent is standalone)
  },
  hierarchyLevel: { type: Number, default: 0 }, // 0=root, 1=child, 2=grandchild, etc.
  
  // Deck exposure control
  // FUNCTIONAL: Controls whether a parent card's deck is publicly listed as playable
  // STRATEGIC: Allows internal decision-tree segments to remain hidden from selection lists
  isPlayable: { type: Boolean, default: true },
  
  // Onboarding label for parent decks that should run as right-only intro
  isOnboarding: { type: Boolean, default: false },
  
  // Rankings
  globalScore: { type: Number, default: 1500 }, // ELO score
  voteCount: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// FUNCTIONAL: Database indexes for performance optimization
// STRATEGIC: Support efficient hierarchical queries for decision tree operations
// Indexes for performance
cardSchema.index({ organizationId: 1, parentTag: 1 });
cardSchema.index({ organizationId: 1, name: 1 });
cardSchema.index({ globalScore: -1 });
// New indexes for hierarchical decision tree functionality
cardSchema.index({ organizationId: 1, isParent: 1, hasChildren: 1 });
cardSchema.index({ organizationId: 1, parentTag: 1, childrenPlayMode: 1 });
cardSchema.index({ organizationId: 1, hierarchyLevel: 1 });

module.exports = mongoose.models.Card || mongoose.model('Card', cardSchema);
