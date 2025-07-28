import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, sparse: true },
  md5: { type: String, required: true, unique: true, index: true },
  uuid: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['text', 'media'], required: true },
  content: {
    text: { 
      type: String,
      required: false,
      validate: {
        validator: function(this: { type: string; content: { text?: string; mediaUrl?: string } }) {
          if (this.type === 'text') {
            return this.content.text != null;
          }
          return true;
        },
        message: 'Text content is required for text type cards'
      }
    },
    mediaUrl: { 
      type: String,
      required: false,
      validate: {
        validator: function(this: { type: string; content: { text?: string; mediaUrl?: string } }) {
          if (this.type === 'media') {
            return this.content.mediaUrl != null;
          }
          return true;
        },
        message: 'Media URL is required for media type cards'
      }
    }
  },
  title: { type: String, default: '' },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Compound Index for performance
CardSchema.index({ isActive: 1, createdAt: -1 });

// Pre-save hook to update timestamps with Date format
CardSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = new Date();
  }
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  next();
});

// Ensure ISO8601 format for all timestamps in toJSON
CardSchema.set('toJSON', {
  transform: function(doc, ret: { createdAt?: Date | string; updatedAt?: Date | string }) {
    if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
    if (ret.updatedAt instanceof Date) ret.updatedAt = ret.updatedAt.toISOString();
    return ret;
  }
});

// Define the interface for the Card document
export interface ICard extends mongoose.Document {
  slug: string;
  md5: string;
  uuid: string;
  type: 'text' | 'media';
  content: {
    text?: string;
    mediaUrl?: string;
  };
  title: string;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Export both the model and its interface
export const Card = mongoose.models.Card || mongoose.model<ICard>('Card', CardSchema);
