import mongoose from 'mongoose';

/**
 * FontPreset Schema - Stores custom font presets for the card editor
 */
const FontPresetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  
  value: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  url: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
    default: ''
  },
  
  isSystem: {
    type: Boolean,
    default: false,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Interface for TypeScript support
export interface IFontPreset extends mongoose.Document {
  name: string;
  value: string;
  url: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Update the updatedAt field on save
FontPresetSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Transform timestamps to ISO8601 in JSON output
FontPresetSchema.set('toJSON', {
  transform: function(doc, ret: { createdAt?: Date | string; updatedAt?: Date | string }) {
    if (ret.createdAt instanceof Date) {
      ret.createdAt = ret.createdAt.toISOString();
    }
    if (ret.updatedAt instanceof Date) {
      ret.updatedAt = ret.updatedAt.toISOString();
    }
    return ret;
  }
});

export const FontPreset = (mongoose.models.FontPreset as mongoose.Model<IFontPreset>) || 
  mongoose.model<IFontPreset>('FontPreset', FontPresetSchema);
