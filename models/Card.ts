import mongoose, { Schema, Document } from 'mongoose';

// Translation interface for text cards
interface ITranslation {
  locale: string;
  title: string;
  content: string;
  description?: string;
}

// Project-specific ranking interface
interface IProjectRanking {
  projectId: string;
  rank: number;
  votes: number;
  lastVotedAt?: Date;
}

// Main Card interface
export interface ICard extends Document {
  title: string;
  description?: string;
  content: string;
  type: 'image' | 'text';
  slug: string;
  hashtags: string[];
  imageAlt?: string;
  likes: number;
  dislikes: number;
  globalScore: number;  // For ELO rating
  translations: ITranslation[];
  projectRankings: IProjectRanking[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalVotes: number; // Virtual
  updateELO(opponentScore: number, won: boolean): Promise<ICard>;
  updateProjectRanking(projectId: string, opponentScore: number, won: boolean): Promise<ICard>;
}

// Translation schema
const TranslationSchema = new Schema<ITranslation>(
  {
    locale: { type: String, required: true, minlength: 2, maxlength: 5 },
    title: { type: String, required: true },
    content: { type: String, required: true },
    description: String,
  },
  { _id: false }
);

// Project ranking schema
const ProjectRankingSchema = new Schema<IProjectRanking>(
  {
    projectId: { type: String, required: true },
    rank: { type: Number, required: true },
    votes: { type: Number, default: 0 },
    lastVotedAt: Date,
  },
  { _id: false }
);

// Main Card schema
const CardSchema = new Schema<ICard>(
  {
    title: { 
      type: String, 
      required: true,
      maxlength: 100,
      trim: true
    },
    description: { 
      type: String,
      maxlength: 500,
      trim: true
    },
    content: { 
      type: String, 
      required: true 
    },
    type: { 
      type: String, 
      enum: ['image', 'text'], 
      required: true 
    },
    slug: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/
    },
    hashtags: {
      type: [String],
      default: [],
      validate: {
        validator: function(v: string[]) {
          return v.every(tag => tag.startsWith('#'));
        },
        message: 'Hashtags must start with #'
      }
    },
    imageAlt: String,
    likes: { type: Number, default: 0, min: 0 },
    dislikes: { type: Number, default: 0, min: 0 },
    globalScore: { type: Number, default: 1500 }, // Initial ELO rating
    translations: [TranslationSchema],
    projectRankings: [ProjectRankingSchema],
    isDeleted: { type: Boolean, default: false },
  },
  { 
    timestamps: true,
    validateBeforeSave: true
  }
);

// Create indexes for improved query performance
CardSchema.index({ hashtags: 1 });
CardSchema.index({ globalScore: -1 });
CardSchema.index({ slug: 1 }, { unique: true });
CardSchema.index({ isDeleted: 1 });
CardSchema.index({ 'projectRankings.projectId': 1 });

// Pre-save middleware for type-specific validations
CardSchema.pre('save', function(next) {
  // For image type, validate URL only
  if (this.type === 'image') {
    if (!this.content.match(/^https?:\/\/.+/)) {
      next(new Error('Image content must be a valid URL'));
    }
  }
  next();
});

// Virtual for total votes
CardSchema.virtual('totalVotes').get(function() {
  return this.likes + this.dislikes;
});

// Method to update ELO rating
CardSchema.methods.updateELO = function(opponentScore: number, won: boolean) {
  const K = 32; // ELO K-factor
  const expectedScore = 1 / (1 + Math.pow(10, (opponentScore - this.globalScore) / 400));
  const actualScore = won ? 1 : 0;
  
  this.globalScore += Math.round(K * (actualScore - expectedScore));
  return this.save();
};

// Method to update project-specific ranking
CardSchema.methods.updateProjectRanking = async function(
  projectId: string, 
  opponentScore: number, 
  won: boolean
) {
  const projectRanking = this.projectRankings.find(
    (pr: IProjectRanking) => pr.projectId === projectId
  );
  
  if (!projectRanking) {
    this.projectRankings.push({
      projectId,
      rank: 1500,
      votes: 0
    });
    return this.save();
  }

  const K = 32;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentScore - projectRanking.rank) / 400));
  const actualScore = won ? 1 : 0;
  
  projectRanking.rank += Math.round(K * (actualScore - expectedScore));
  projectRanking.votes += 1;
  projectRanking.lastVotedAt = new Date();
  
  return this.save();
};

export const Card = mongoose.models.Card || mongoose.model<ICard>('Card', CardSchema);
