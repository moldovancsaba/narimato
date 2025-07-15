import mongoose, { Schema, Document } from 'mongoose';

export interface ICard extends Document {
  title: string;
  description?: string;
  content: string;
  type: 'image' | 'text';
  slug: string;
  hashtags: string[];
  translationKey?: string;
  imageAlt?: string;
  likes: number;
  dislikes: number;
  rank: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CardSchema = new Schema<ICard>(
  {
    title: { type: String, required: true },
    description: String,
    content: { type: String, required: true },
    type: { type: String, enum: ['image', 'text'], required: true },
    slug: { type: String, required: true, unique: true },
    hashtags: [String],
    translationKey: String,
    imageAlt: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    rank: { type: Number, default: 1500 }, // Initial ELO rating
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create indexes
CardSchema.index({ hashtags: 1 });
CardSchema.index({ rank: -1 });

export const Card = mongoose.models.Card || mongoose.model<ICard>('Card', CardSchema);
