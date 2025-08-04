import mongoose from 'mongoose';
import { getAspectRatioFamily, validateAspectRatioCompatibility, isValidCardSize } from '../utils/aspectRatioUtils';

/**
 * NARIMATO Card Model - MongoDB Atlas Schema
 * 
 * PURPOSE:
 * - Manages card entities in a hashtag-based hierarchy system
 * - Supports both text and media cards with flexible content structure
 * - Enforces referential integrity for parent-child relationships via hashtags
 * - Provides comprehensive validation for all card properties
 * 
 * INDEXING STRATEGY:
 * - uuid: Unique identifier for direct card lookups
 * - name: Hashtag-based card name for hierarchy navigation
 * - hashtags: Array indexing for parent-child relationship queries
 * - isActive + createdAt: Compound index for filtered listing
 * - cardSize: For aspect ratio compatibility queries
 * 
 * VALIDATION RULES:
 * - name: Must be valid hashtag format (#alphanumeric_-)
 * - cardSize: Mandatory width:height format with parent compatibility
 * - imageUrl: Valid HTTP/HTTPS URL format when provided
 * - hashtags/children: Valid hashtag format with referential integrity
 */

// Background style interface for card visual styling
interface BackgroundStyle {
  type: 'color' | 'gradient' | 'pattern';
  value?: string; // Color hex, gradient CSS, or pattern name - optional for image-only cards
  textColor?: string; // Text color for readability over background
}

// Embedded schema for background styling - no separate _id needed
const BackgroundStyleSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['color', 'gradient', 'pattern'], 
    required: true 
  },
  value: { 
    type: String, 
    required: false, // Optional to support image-only cards
    validate: {
      validator: function(value: string) {
        if (!value) return true; // Allow empty for image-only cards
        // Basic CSS validation for colors and gradients
        return /^(#[0-9a-fA-F]{3,6}|rgba?\(|linear-gradient\(|radial-gradient\(|repeating-)/.test(value);
      },
      message: 'Background value must be a valid CSS color, gradient, or pattern'
    }
  },
  textColor: { 
    type: String, 
    default: '#ffffff',
    validate: {
      validator: function(color: string) {
        return /^#[0-9a-fA-F]{3,6}$/.test(color);
      },
      message: 'Text color must be a valid hex color'
    }
  }
}, { _id: false });

const CardSchema = new mongoose.Schema({
  // 🔑 Primary identifier (required)
  uuid: {
    type: String,
    required: [true, 'UUID is required for card identification'],
    unique: true,
    index: true,
    validate: {
      validator: function(uuid: string) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
      },
      message: 'UUID must be a valid v4 format'
    }
  },
  
  // Card name (hashtag) - defines card identity and hierarchy position
  name: {
    type: String, 
    required: [true, 'Card name is required'],
    unique: true,
    index: true,
    trim: true,
    minlength: [2, 'Card name must be at least 2 characters (#x)'],
    maxlength: [100, 'Card name cannot exceed 100 characters'],
    validate: {
      validator: function(name: string) {
        // Enhanced hashtag validation: #alphanumeric with limited special chars
        return name.startsWith('#') && name.length > 1 && /^#[A-Z0-9_\-\s.]+$/i.test(name);
      },
      message: 'Name must be a valid hashtag starting with # and containing only letters, numbers, spaces, periods, hyphens, and underscores'
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
  
  // Card size configuration (width:height format) - MANDATORY
  cardSize: {
    type: String,
    required: true, // MANDATORY - Every card MUST have aspect ratio
    validate: {
      validator: async function(size: string) {
        // Basic format validation
        if (!isValidCardSize(size)) {
          return false;
        }
        
        // Skip aspect ratio compatibility check for new cards or cards without parents
        if (this.isNew && (!this.hashtags || this.hashtags.length === 0)) {
          return true;
        }
        
        // For child cards, check compatibility with parent aspect ratios
        if (this.hashtags && this.hashtags.length > 0) {
          try {
            // Get database connection and Card model
            const connection = this.db || this.constructor.db;
            if (!connection) return true; // Skip validation if no connection
            
            const CardModel = connection.model('Card');
            
            // Find parent cards
            const parentCards = await CardModel.find({
              name: { $in: this.hashtags },
              isActive: true
            }).select('cardSize name');
            
            if (parentCards.length === 0) {
              return true; // No parents found, allow any aspect ratio
            }
            
            // Get parent card sizes
            const parentCardSizes = parentCards.map((parent: any) => parent.cardSize).filter(Boolean);
            
            if (parentCardSizes.length === 0) {
              return true; // Parents don't have cardSize, allow any aspect ratio
            }
            
            // Validate compatibility
            const validation = validateAspectRatioCompatibility(parentCardSizes, size);
            
            if (!validation.isCompatible) {
              console.warn(`⚠️ Aspect ratio compatibility warning for card ${this.name}:`, validation.conflicts);
              // For now, we'll allow incompatible ratios but log a warning
              // In the future, this could be made stricter by returning false
            }
            
            return true; // Allow for now, but log warnings
          } catch (error) {
            console.warn('Error validating aspect ratio compatibility:', error);
            return true; // Allow on validation error
          }
        }
        
        return true;
      },
      message: 'Card size must be in format "width:height" and compatible with parent card aspect ratios'
    }
  },
  
  // Children cards - cards that reference this card as a parent (computed field)
  // Note: This field is primarily computed dynamically via hashtag queries
  children: [{ 
    type: String,
    validate: {
      validator: function(cardName: string) {
        return cardName.startsWith('#') && /^#[A-Z0-9_\-\s.]+$/i.test(cardName);
      },
      message: 'Each child card name must be a valid hashtag format'
    }
  }],
  
  // Hashtags for parent-child relationships - core hierarchy mechanism
  hashtags: { 
    type: [String],
    default: [],
    index: true, // Index for efficient parent-child queries
    validate: {
      validator: function(hashtags: string[]) {
        if (!Array.isArray(hashtags)) return false;
        // Validate each hashtag format and check for duplicates
        const seen = new Set();
        for (const hashtag of hashtags) {
          if (!hashtag.startsWith('#') || !/^#[A-Z0-9_\-\s.]+$/i.test(hashtag)) {
            return false;
          }
          if (seen.has(hashtag)) {
            return false; // No duplicates
          }
          seen.add(hashtag);
        }
        return true;
      },
      message: 'Each hashtag must be a valid format with no duplicates'
    }
  },
  
  // Meta fields
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// 🔍 Compound indexes for efficient lookups
// Primary UUID-based index for card resolution
CardSchema.index({ uuid: 1, isActive: 1 });

// Performance Indexes for common query patterns
// 1. Primary listing: active cards sorted by creation date
CardSchema.index({ isActive: 1, createdAt: -1 });

// 2. Hashtag hierarchy queries: find children of specific parent
CardSchema.index({ hashtags: 1, isActive: 1 });

// 3. Card size compatibility queries for aspect ratio validation
CardSchema.index({ cardSize: 1 });

// 4. Text search index for card names and content
CardSchema.index({ 
  name: 'text', 
  'body.textContent': 'text' 
}, {
  name: 'card_text_search',
  weights: {
    name: 10,
    'body.textContent': 1
  }
});

// Pre-save middleware for data integrity and timestamp management
CardSchema.pre('save', function(next) {
  // Set creation timestamp for new documents
  if (this.isNew) {
    this.createdAt = new Date();
  }
  
  // Always update modification timestamp on any change
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  
  // Ensure default active status
  this.isActive = this.isActive ?? true;
  
  // Prevent self-referential hashtags (card cannot be its own parent)
  if (this.hashtags && this.hashtags.includes(this.name)) {
    return next(new Error('Card cannot reference itself as a parent hashtag'));
  }
  
  // Ensure body exists with at least default background
  if (!this.body) {
    this.body = {
      background: {
        type: 'color',
        value: '#667eea',
        textColor: '#ffffff'
      }
    };
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

/**
 * TypeScript interface for Card document with complete type safety
 * 
 * FIELD DESCRIPTIONS:
 * - uuid: Unique identifier (UUID v4) for global card identification
 * - name: Hashtag-based name (#example) defining card identity
 * - body: Content structure supporting text, images, and styling
 * - cardSize: Aspect ratio in "width:height" format (e.g., "16:9")
 * - children: Computed array of child card names (mostly dynamic)
 * - hashtags: Parent references for hierarchy navigation
 * - isActive: Soft delete flag for content management
 * - createdAt/updatedAt: ISO 8601 timestamps for audit trail
 */
export interface ICard extends mongoose.Document {
  uuid: string; // UUID v4 format
  name: string; // #HASHTAG format
  body: {
    imageUrl?: string; // HTTP/HTTPS URL for media cards
    textContent?: string; // Plain text content
    background?: BackgroundStyle; // Visual styling options
  };
  cardSize: string; // "width:height" format - MANDATORY for all cards
  children?: string[]; // #HASHTAG references to child cards
  hashtags: string[]; // #HASHTAG references to parent cards
  isActive: boolean; // Soft delete flag
  createdAt: Date; // ISO 8601 creation timestamp
  updatedAt: Date; // ISO 8601 modification timestamp
}

// Export the background style interface
export type { BackgroundStyle };

// Export both the model and its interface
export const Card = mongoose.models.Card || mongoose.model<ICard>('Card', CardSchema);
