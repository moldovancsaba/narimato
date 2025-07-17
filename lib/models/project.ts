import { Schema, model, Document } from 'mongoose';

/**
 * Represents the structure of a card within a project
 * - cardId: Reference to the card document
 * - addedAt: Timestamp when the card was added to the project
 * - addedBy: Identifier of the user who added the card
 * - order: Position of the card in the project's sequence
 */
interface ProjectCard {
  cardId: Schema.Types.ObjectId;
  addedAt: Date;
  addedBy: string;
  order: number;
}

/**
 * Defines the complete structure of a Project document
 * Currently focused on managing an ordered collection of cards
 */
export interface ProjectSchema extends Document {
  cards: ProjectCard[];
}

/**
 * MongoDB schema definition for Project documents
 * Includes validation rules and required fields for card entries
 */
const projectSchema = new Schema<ProjectSchema>({
  cards: [{
    cardId: { 
      type: Schema.Types.ObjectId, 
      required: true,
      ref: 'Card' // Reference to Card model
    },
    addedAt: { 
      type: Date, 
      required: true,
      default: Date.now 
    },
    addedBy: { 
      type: String, 
      required: true 
    },
    order: { 
      type: Number, 
      required: true 
    }
  }]
});

// Indexes for optimizing card-related queries
// cards.cardId: Enables efficient lookups of specific cards within projects
projectSchema.index({ 'cards.cardId': 1 });

// cards.order: Supports efficient sorting and ordering operations
projectSchema.index({ 'cards.order': 1 });

export const Project = model<ProjectSchema>('Project', projectSchema);
