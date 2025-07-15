import { Card, ICard } from '@/models/Card';
import { validateCard, validateCardUpdate, generateSlug, CardInput } from '@/lib/validations/card';
import { UserSession } from '@/models/UserSession';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

export class CardService {
  /**
   * Creates a new card with validation
   * @param cardData Raw card data to be validated and saved
   * @returns Created card document
   */
  static async createCard(cardData: CardInput): Promise<ICard> {
    await dbConnect();
    
    // Validate the input data
    const validatedData = validateCard(cardData);
    
    // Generate slug if not provided
    if (!validatedData.slug) {
      validatedData.slug = generateSlug(validatedData.title);
    }
    
    // Create the card
    const card = new Card(validatedData);
    await card.save();
    
    return card;
  }
  
  /**
   * Updates an existing card
   * @param cardId ID of the card to update
   * @param updateData Partial card data for update
   * @returns Updated card document
   */
  static async updateCard(cardId: string, updateData: Partial<CardInput>): Promise<ICard | null> {
    await dbConnect();
    
    // Validate the update data
    const validatedUpdate = validateCardUpdate(updateData);
    
    // If title is being updated, update slug as well
    if (validatedUpdate.title) {
      validatedUpdate.slug = generateSlug(validatedUpdate.title);
    }
    
    const card = await Card.findByIdAndUpdate(
      cardId,
      { $set: validatedUpdate },
      { new: true, runValidators: true }
    );
    
    return card;
  }
  
  /**
   * Soft deletes a card
   * @param cardId ID of the card to delete
   * @returns True if successful
   */
  static async deleteCard(cardId: string): Promise<boolean> {
    await dbConnect();
    
    const result = await Card.findByIdAndUpdate(
      cardId,
      { $set: { isDeleted: true } },
      { new: true }
    );
    
    return !!result;
  }
  
  /**
   * Retrieves a card by its slug
   * @param slug Card's slug
   * @returns Card document if found
   */
  static async getCardBySlug(slug: string): Promise<ICard | null> {
    await dbConnect();
    return Card.findOne({ slug, isDeleted: false });
  }
  
  /**
   * Updates a card's project ranking
   * @param cardId ID of the card
   * @param projectId ID of the project
   * @param newRank New ranking value
   * @returns Updated card
   */
  static async updateProjectRanking(
    cardId: string,
    projectId: string,
    newRank: number
  ): Promise<ICard | null> {
    await dbConnect();
    
    const card = await Card.findById(cardId);
    if (!card) return null;
    
    // Find existing project ranking or create new one
    const rankingIndex = card.projectRankings.findIndex(
      (pr: { projectId: string }) => pr.projectId === projectId
    );
    
    if (rankingIndex >= 0) {
      card.projectRankings[rankingIndex].rank = newRank;
      card.projectRankings[rankingIndex].votes += 1;
      card.projectRankings[rankingIndex].lastVotedAt = new Date();
    } else {
      card.projectRankings.push({
        projectId,
        rank: newRank,
        votes: 1,
        lastVotedAt: new Date(),
      });
    }
    
    await card.save();
    return card;
  }
  
  /**
   * Gets random cards that haven't reached the like threshold
   * @param limit Number of cards to return
   * @returns Array of card documents
   */
  static async getRandomCards(limit: number = 1, sessionId?: string): Promise<ICard[]> {
    await dbConnect();
    
    // Get disliked cards for the session if provided
    let dislikedCardIds: string[] = [];
    if (sessionId) {
      const session = await UserSession.findOne({ sessionId });
      if (session) {
        dislikedCardIds = session.dislikedCards;
      }
    }
    
    const cards = await Card.aggregate([
      { 
        $match: { 
          isDeleted: false, 
          likes: { $lt: 1 },
          _id: { $nin: dislikedCardIds.map(id => new mongoose.Types.ObjectId(id)) }
        } 
      },
      { $sample: { size: limit } },
    ]).exec();
    
    return cards;
  }
  
  /**
   * Gets cards for head-to-head voting
   * @param limit Number of pairs to return
   * @returns Array of card pairs
   */
  static async getVotingPairs(limit: number = 1): Promise<[ICard, ICard][]> {
    await dbConnect();
    
    // Get cards with at least 2 likes
    const eligibleCards = await Card.find({
      isDeleted: false,
      likes: { $gte: 1 },
    }).exec();
    
    // Shuffle the cards
    const shuffled = eligibleCards.sort(() => Math.random() - 0.5);
    
    // Create pairs
    const pairs: [ICard, ICard][] = [];
    for (let i = 0; i < Math.min(limit, Math.floor(shuffled.length / 2)); i++) {
      pairs.push([shuffled[i * 2], shuffled[i * 2 + 1]]);
    }
    
    return pairs;
  }
}
