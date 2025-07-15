import { Schema, model, models, Document } from 'mongoose';

// Translation schema for text content
interface Translation {
  languageCode: string;
  content: string;
  title?: string;
  description?: string;
}

// Card document interface
export interface ICard extends Document {
  type: 'image' | 'text';
  content: string;
  title?: string;
  description?: string;
  slug: string;
  translations?: Translation[];
  hashtags: string[];
  aspectRatio: '1:1' | '4:3' | '16:9' | '21:9';
  imageAlt?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // For soft deletion
  isDeleted: boolean;
}

// Translation schema definition
const TranslationSchema = new Schema<Translation>({
  languageCode: { type: String, required: true },
  content: { type: String, required: true },
  title: String,
  description: String,
});

// Card schema definition
const CardSchema = new Schema<ICard>({
  type: {
    type: String,
    enum: ['image', 'text'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  title: String,
  description: String,
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  translations: [TranslationSchema],
  hashtags: [{
    type: String,
    index: true,
  }],
  aspectRatio: {
    type: String,
    enum: ['1:1', '4:3', '16:9', '21:9'],
    default: '4:3',
  },
  imageAlt: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  deletedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
});

// Middleware to update the updatedAt timestamp
CardSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual property to determine if a card is deleted
CardSchema.virtual('isDeleted').get(function() {
  return Boolean(this.deletedAt);
});

// Instance method for soft deletion
CardSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  this.isDeleted = true;
  return this.save();
};

// Instance method for restoration
CardSchema.methods.restore = function() {
  this.deletedAt = undefined;
  this.isDeleted = false;
  return this.save();
};

// Static method to find non-deleted cards
CardSchema.statics.findAvailable = function() {
  return this.find({ isDeleted: false });
};

// Static method to find by hashtags
CardSchema.statics.findByHashtags = function(hashtags: string[]) {
  return this.find({
    hashtags: { $in: hashtags },
    isDeleted: false,
  });
};

// Ensure proper indexing for efficient queries
CardSchema.index({ updatedAt: -1 });
CardSchema.index({ hashtags: 1, isDeleted: 1 });
CardSchema.index({ type: 1, isDeleted: 1 });

// Export the model
export const Card = models.Card || model<ICard>('Card', CardSchema);
