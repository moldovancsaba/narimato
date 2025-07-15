import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSession extends Document {
  sessionId: string;
  dislikedCards: string[]; // Array of card IDs
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema = new Schema<IUserSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    dislikedCards: [{
      type: String,
      ref: 'Card',
    }],
  },
  { timestamps: true }
);

// Create indexes for performance
UserSessionSchema.index({ sessionId: 1 });
UserSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // TTL index, session expires after 7 days

export const UserSession = mongoose.models.UserSession || mongoose.model<IUserSession>('UserSession', UserSessionSchema);
