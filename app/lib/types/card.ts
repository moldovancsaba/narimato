// Background style interface to match the database model
interface BackgroundStyle {
  type: 'color' | 'gradient' | 'pattern';
  value: string;
  textColor?: string;
}

// Updated Card interface to match current database schema (ICard from models/Card.ts)
export interface Card {
  uuid: string;
  name: string; // #HASHTAG
  body: {
    imageUrl?: string;
    textContent?: string;
    background?: BackgroundStyle;
  };
  cardSize?: string; // Card size in "width:height" format (e.g., "300:400")
  hashtags: string[]; // Array of #HASHTAG references to parent cards
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
