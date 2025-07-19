import mongoose from 'mongoose'

export interface ICard {
  _id: string
  id: string
  type: 'text' | 'image'
  title: string
  content: string
  description?: string
  slug: string
  hashtags: string[]
  translationKey?: string
  imageAlt?: string
  globalScore?: number
  createdAt: Date | string
  updatedAt: Date | string
  likes?: number
  dislikes?: number
}

const cardSchema = new mongoose.Schema<ICard>({
  type: { type: String, enum: ['text', 'image'], required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  description: String,
  slug: { type: String, required: true, unique: true },
  hashtags: [String],
  translationKey: String,
  imageAlt: String,
  globalScore: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
}, {
  timestamps: true,
})

export const Card = mongoose.models.Card || mongoose.model<ICard>('Card', cardSchema)
