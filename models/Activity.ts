import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActivity extends Document {
  type: 'created' | 'updated' | 'deleted' | 'card_added' | 'card_removed' | 'collaborator_added' | 'collaborator_removed' | 'comment_added';
  projectId: Types.ObjectId;
  projectTitle: string;
  timestamp: Date;
  userId: Types.ObjectId;
  userName: string;
  details?: Record<string, any>;
}

const ActivitySchema = new Schema<IActivity>({
  type: {
    type: String,
    required: true,
    enum: [
      'created',
      'updated',
      'deleted',
      'card_added',
      'card_removed',
      'collaborator_added',
      'collaborator_removed',
      'comment_added'
    ],
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  projectTitle: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  details: {
    type: Schema.Types.Mixed,
    required: false,
  },
});

// Create indexes for better query performance
ActivitySchema.index({ projectId: 1, timestamp: -1 });
ActivitySchema.index({ userId: 1, timestamp: -1 });
ActivitySchema.index({ timestamp: -1 });

export const Activity = mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;
