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
  
  // Rankings
  globalScore: { type: Number, default: 1500 }, // ELO score
  voteCount: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Indexes for performance
cardSchema.index({ organizationId: 1, parentTag: 1 });
cardSchema.index({ organizationId: 1, name: 1 });
cardSchema.index({ globalScore: -1 });

module.exports = mongoose.models.Card || mongoose.model('Card', cardSchema);
