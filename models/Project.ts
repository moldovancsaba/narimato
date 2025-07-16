import mongoose, { Schema, Document, Types } from 'mongoose';
import { ICard } from './Card';

// Interface representing a Project document
export interface IProject extends Document {
  name: string;
  slug: string;
  description?: string;
  isAnonymous: boolean;
  anonymousId?: string;
  settings: {
    visibility: 'public' | 'private';
    allowComments: boolean;
    cardOrder: 'manual' | 'date' | 'popularity';
    isFeatured: boolean;
  };
  cards: Types.ObjectId[] | ICard[];
  tags: Array<{
    name: string;
    color?: string;
    description?: string;
  }>;
  activity: Array<{
    type: string;
    timestamp: Date;
    userId: string;
    details?: Record<string, any>;
  }>;
  createdBy: Types.ObjectId | string;
  collaborators: Types.ObjectId[];
  viewCount: number;
  lastViewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  reorderCards(cardId: string, newPosition: number): Promise<void>;
}

// Project schema definition
const ProjectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name must be 100 characters or less'],
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
      trim: true,
      maxlength: [500, 'Description must be 500 characters or less'],
    },
    isAnonymous: {
      type: Boolean,
      required: true,
      default: false
    },
    anonymousId: {
      type: String,
      sparse: true,
      index: true,
      validate: {
validator: function(this: IProject, value: string | undefined) {
          // If project is anonymous, anonymousId must be present
          if (this.isAnonymous && !value) {
            return false;
          }
          // If project is not anonymous, anonymousId must not be present
          if (!this.isAnonymous && value) {
            return false;
          }
          return true;
        },
        message: 'anonymousId must be present for anonymous projects and absent for non-anonymous projects'
      }
    },
    settings: {
      visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public',
        required: true
      },
      allowComments: {
        type: Boolean,
        default: true
      },
      cardOrder: {
        type: String,
        enum: ['manual', 'date', 'popularity'],
        default: 'manual'
      },
      isFeatured: {
        type: Boolean,
        default: false
      }
    },
    cards: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
    }],
    tags: [{
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: [1, 'Tag name cannot be empty'],
        maxlength: [30, 'Tag name too long']
      },
      color: {
        type: String,
        match: /^#[0-9a-f]{6}$/i
      },
      description: String
    }],
    activity: [{
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
        ]
      },
      timestamp: {
        type: Date,
        required: true,
        default: Date.now
      },
      userId: {
        type: String,
        required: true,
        validate: [
          function(this: any, value: string) {
            return value && value.length > 0;
          },
          'Invalid user ID'
        ]
      },
      details: mongoose.Schema.Types.Mixed
    }],
    createdBy: {
      type: String,
      required: true,
      validate: [
        function(this: any, value: string) {
          return value && value.length > 0;
        },
        'Invalid user ID'
      ]
    },
    collaborators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      validate: {
        validator: async function(userId: mongoose.Types.ObjectId) {
          const User = mongoose.models.User;
          const user = await User.findById(userId);
          return user !== null;
        },
        message: 'Referenced collaborator does not exist'
      }
    }],
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastViewedAt: Date
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
ProjectSchema.index({ createdBy: 1 }); // Index for createdBy field
ProjectSchema.index({ collaborators: 1 }); // Index for collaborators array
ProjectSchema.index({ 'settings.visibility': 1 }); // Index for visibility settings
ProjectSchema.index({ 'activity.userId': 1 }); // Index for activity user references
ProjectSchema.index({ isAnonymous: 1 }); // Index for filtering anonymous vs non-anonymous projects
ProjectSchema.index({ anonymousId: 1 }, { sparse: true }); // Sparse index for anonymousId field

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
