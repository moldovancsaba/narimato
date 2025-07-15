import mongoose, { Schema, Document, Types } from 'mongoose';
import { ICard } from './Card';

// Interface representing a Project document
export interface IProject extends Document {
  title: string;
  slug: string;
  description: string;
  cards: Types.ObjectId[] | ICard[];
  createdBy: Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  reorderCards(cardId: string, newPosition: number): Promise<void>;
}

// Project schema definition
const ProjectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9-]+$/
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    cards: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Creator reference is required'],
    },
    isPublic: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Method to reorder cards within a project
ProjectSchema.methods.reorderCards = async function(cardId: string, newPosition: number): Promise<void> {
  // Validate inputs
  if (newPosition < 0 || newPosition >= this.cards.length) {
    throw new Error('Invalid position specified');
  }

  // Find current position of the card
  const currentPosition = this.cards.findIndex(
    (card: mongoose.Types.ObjectId) => card.toString() === cardId
  );

  if (currentPosition === -1) {
    throw new Error('Card not found in project');
  }

  // Remove card from current position
  const [cardToMove] = this.cards.splice(currentPosition, 1);
  // Insert card at new position
  this.cards.splice(newPosition, 0, cardToMove);

  // Save the updated card order
  await this.save();

  // Update rankings in the Card model for this project
  const Card = mongoose.models.Card;
  await Card.updateMany(
    { _id: { $in: this.cards } },
    [
      {
        $set: {
          'projectRankings': {
            $map: {
              input: '$projectRankings',
              as: 'ranking',
              in: {
                $cond: [
                  { $eq: ['$$ranking.projectId', this._id] },
                  {
                    projectId: '$$ranking.projectId',
                    rank: { 
                      $indexOfArray: [this.cards, '$_id']
                    },
                    votes: '$$ranking.votes',
                    lastVotedAt: '$$ranking.lastVotedAt'
                  },
                  '$$ranking'
                ]
              }
            }
          }
        }
      }
    ]
  );
};

// Validation middleware
ProjectSchema.pre('save', function(next) {
  // Ensure cards array has no duplicates
  const cardIds = this.cards.map(card => card.toString());
  const uniqueCardIds = [...new Set(cardIds)];
  
  if (cardIds.length !== uniqueCardIds.length) {
    next(new Error('Duplicate cards are not allowed in a project'));
    return;
  }

  next();
});

// Create indexes for improved query performance
ProjectSchema.index({ slug: 1 }, { unique: true });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ isPublic: 1 });

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
