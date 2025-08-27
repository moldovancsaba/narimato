import mongoose from 'mongoose';

/**
 * BackgroundPreset Schema - Stores custom background presets for the card editor
 */
const BackgroundPresetSchema = new mongoose.Schema({
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
    maxlength: 500
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
export interface IBackgroundPreset extends mongoose.Document {
  name: string;
  value: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Update the updatedAt field on save
BackgroundPresetSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Transform timestamps to ISO8601 in JSON output
BackgroundPresetSchema.set('toJSON', {
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

export const BackgroundPreset = (mongoose.models.BackgroundPreset as mongoose.Model<IBackgroundPreset>) || 
  mongoose.model<IBackgroundPreset>('BackgroundPreset', BackgroundPresetSchema);
