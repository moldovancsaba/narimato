import mongoose from 'mongoose';

// Background style interface
interface BackgroundStyle {
  type: 'color' | 'gradient' | 'pattern';
  value: string; // Color hex, gradient CSS, or pattern name
  textColor?: string; // Text color for readability
}

const BackgroundStyleSchema = new mongoose.Schema({
  type: { type: String, enum: ['color', 'gradient', 'pattern'], required: true },
  value: { type: String, required: true },
  textColor: { type: String, default: '#ffffff' }
}, { _id: false });

const CardSchema = new mongoose.Schema({
  // Core identification
  uuid: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  // Card name (hashtag) - this defines the card identity
  name: { 
    type: String, 
    required: true, 
    unique: true,
    index: true,
    validate: {
      validator: function(name: string) {
        return name.startsWith('#') && name.length > 1 && /^#[A-Z0-9_-]+$/i.test(name);
      },
      message: 'Name must be a valid hashtag starting with # and containing only letters, numbers, hyphens, and underscores'
    }
  },
  
  // Card body content
  body: {
    imageUrl: { 
      type: String, 
      required: false,
      validate: {
        validator: function(url: string) {
          if (!url) return true; // Optional field
          return /^https?:\/\/.+/.test(url);
        },
        message: 'Image URL must be a valid HTTP/HTTPS URL'
      }
    },
    textContent: { 
      type: String, 
      required: false 
    },
    background: { 
      type: BackgroundStyleSchema, 
      required: false,
      default: {
        type: 'color',
        value: '#667eea',
        textColor: '#ffffff'
      }
    }
  },
  
  // Hashtags for parent-child relationships
  hashtags: [{ 
    type: String,
    validate: {
      validator: function(hashtag: string) {
        return hashtag.startsWith('#') && /^#[A-Z0-9_-]+$/i.test(hashtag);
      },
      message: 'Each hashtag must start with # and contain only letters, numbers, hyphens, and underscores'
    }
  }],
  
  // Meta fields
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
  this.isActive = this.isActive ?? true; // Default to active if not set
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
  uuid: string;
  name: string; // #HASHTAG
  body: {
    imageUrl?: string;
    textContent?: string;
    background?: BackgroundStyle;
  };
  hashtags: string[]; // Array of #HASHTAG references to parent cards
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Export the background style interface
export type { BackgroundStyle };

// Export both the model and its interface
export const Card = mongoose.models.Card || mongoose.model<ICard>('Card', CardSchema);
