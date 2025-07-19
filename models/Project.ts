import mongoose, { Types } from 'mongoose'

export interface IProject {
  _id: string
  title: string
  description?: string
  slug: string
  cards: Types.ObjectId[]
  settings: {
    cardOrder: 'manual' | 'alphabetical' | 'popularity'
  }
  createdAt: string
  updatedAt: string
}

const projectSchema = new mongoose.Schema<IProject>({
  title: { type: String, required: true },
  description: String,
  slug: { type: String, required: true, unique: true },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }],
  settings: {
    cardOrder: { type: String, enum: ['manual', 'alphabetical', 'popularity'], default: 'manual' }
  }
}, {
  timestamps: true,
})

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', projectSchema)
