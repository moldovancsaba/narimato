import mongoose, { Document, Schema } from 'mongoose';

export interface IUserSession extends Document {
  userId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  metadata?: {
    [key: string]: any;
  };
}

const userSessionSchema = new Schema({
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  startTime: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  endTime: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    required: true,
    default: true 
  },
  metadata: { 
    type: Schema.Types.Mixed 
  }
}, {
  timestamps: true
});

export const UserSession = mongoose.models.UserSession || mongoose.model<IUserSession>('UserSession', userSessionSchema);
