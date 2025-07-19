import { Document } from 'mongoose';

export interface BaseEntity {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface IProject extends BaseEntity {
  title: string;
  slug: string;
  description?: string;
  settings: {
    visibility: 'public' | 'private';
    allowComments: boolean;
    cardOrder: 'manual' | 'date' | 'popularity';
    isFeatured: boolean;
  };
  cards: string[];
  tags: Array<{
    name: string;
    color?: string;
    description?: string;
  }>;
  createdBy: string;
  collaborators: string[];
  viewCount: number;
  lastViewedAt?: string;
}

export interface ICard extends BaseEntity {
  title: string;
  content: string;
  type: 'image' | 'text';
  slug: string;
  description?: string;
  hashtags: string[];
  imageAlt?: string;
  likes: number;
  dislikes: number;
  globalScore: number;
  projectRankings: Array<{
    projectId: string;
    rank: number;
    votes: number;
    lastVotedAt?: string;
  }>;
  translations: Array<{
    locale: string;
    title: string;
    content: string;
    description?: string;
  }>;
}
