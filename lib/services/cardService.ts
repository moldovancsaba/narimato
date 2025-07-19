import { Card } from '@/models';
import { Project } from '@/models/Project';
import type { ICard } from '@/models/Card';
import { validateCard, validateCardUpdate, generateSlug, CardInput } from '@/lib/validations/card';
import { UserSession } from '@/models/UserSession';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import { DatabaseError } from '@/lib/errors';
import { PersonalRanking } from '@/models/PersonalRanking';

export class CardService {
  /**
   * Creates a new card with validation
   * @param cardData Raw card data to be validated and saved
   * @returns Created card document
   */
  static async createCard(cardData: CardInput): Promise<ICard> {
    console.log('[Card Service] Attempting to create new card:', { title: cardData.title });
    await dbConnect();
    
    try {
      // Validate the input data
      const validatedData = validateCard(cardData);
      console.log('[Card Service] Card data validation successful');
      
      // Generate slug if not provided
      if (!validatedData.slug) {
        validatedData.slug = generateSlug(validatedData.title);
        console.log(`[Card Service] Generated slug for card: ${validatedData.slug}`);
      }

      // Create the card
      const card = new Card(validatedData);
      await card.save();
      
      console.log(`[Card Service] Successfully created card with ID: ${card._id} and slug: ${card.slug}`);
      return card;
    } catch (error) {
      console.error('[Card Service] Error creating card:', error);
      throw error;
    }
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
      console.log(`[Card Service] Generated new slug for title update: ${validatedUpdate.slug}`);
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
    console.log(`[Card Service] Attempting to delete card: ${cardId}`);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await dbConnect();

      // Soft delete the card
      const card = await Card.findByIdAndUpdate(
        cardId,
        { $set: { isDeleted: true } },
        { new: true, session }
      );

      if (!card) {
        throw new Error('Card not found');
      }

      // Remove the card from all projects that reference it
      await Project.updateMany(
        { cards: cardId },
        { $pull: { cards: cardId } },
        { session }
      );

      await session.commitTransaction();
      console.log(`[Card Service] Successfully deleted card: ${cardId}`);
      return true;
    } catch (error) {
      await session.abortTransaction();
      console.error('[Card Service] Error deleting card:', error);
      throw new DatabaseError('Failed to delete card', error);
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Retrieves a card by its MD5 hash
   * @param md5 MD5 hash of the card
   * @returns Card document if found
   */
  static async getCardByMD5(md5: string): Promise<ICard | null> {
    console.log(`[Card Service] Attempting to fetch card with MD5: ${md5}`);
    await dbConnect();

    try {
      const card = await Card.findOne({ md5, isDeleted: false });
      if (!card) {
        console.warn(`[Card Service] Card not found with MD5: ${md5}`);
        return null;
      }
      console.log(`[Card Service] Successfully retrieved card: ${card._id}`);
      return card;
    } catch (error) {
      console.error(`[Card Service] Error fetching card by MD5 ${md5}:`, error);
      throw error;
    }
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
  static async getRandomCards(limit: number = 1, sessionId?: string, projectId?: string): Promise<ICard[]> {
    await dbConnect();
    
    // Get voted cards for the session and project if provided
    let excludedCardIds: string[] = [];
    if (sessionId && projectId) {
      const personalRanking = await PersonalRanking.findOne({ sessionId, projectId });
      if (personalRanking) {
excludedCardIds = personalRanking.rankings.map((r: { cardId: string }) => r.cardId);
      }
    }
    
    // Build match criteria
    const matchCriteria: any = {
      isDeleted: false,
    };

    // Add project filter if projectId is provided
    if (projectId) {
      matchCriteria.projectRankings = {
        $elemMatch: { projectId }
      };
    }

    // Add exclusion for already voted cards
    if (excludedCardIds.length > 0) {
      matchCriteria._id = { 
        $nin: excludedCardIds.map(id => new mongoose.Types.ObjectId(id))
      };
    }
    
    const cards = await Card.aggregate([
      { $match: matchCriteria },
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

/**
 * Adds a project to a card's rankings
 * 
 * @param cardId - ID of the card
 * @param projectId - ID of the project
 * @returns Updated card document
 */
static async addProjectToCard(cardId: string, projectId: string): Promise<ICard | null> {
  console.log(`[Card Service] Adding project ${projectId} to card ${cardId}`);
  
  try {
    await dbConnect();
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Add project to card's rankings if not already present
    const card = await Card.findOneAndUpdate(
      {
        _id: cardId,
        'projectRankings.projectId': { $ne: projectId }
      },
      {
        $addToSet: {
          projectRankings: {
            projectId,
            rank: 1500,  // Initial ranking
            votes: 0
          }
        }
      },
      { new: true, runValidators: true }
    );
    
    return card;
  } catch (error) {
    console.error('[Card Service] Error adding project to card:', error);
    throw new DatabaseError('Failed to add project to card', error);
  }
}

/**
 * Removes a project from a card's rankings
 * 
 * @param cardId - ID of the card
 * @param projectId - ID of the project
 * @returns Updated card document
 */
static async removeProjectFromCard(cardId: string, projectId: string): Promise<ICard | null> {
  console.log(`[Card Service] Removing project ${projectId} from card ${cardId}`);
  
  try {
    await dbConnect();
    
    const card = await Card.findOneAndUpdate(
      { _id: cardId },
      { $pull: { projectRankings: { projectId } } },
      { new: true, runValidators: true }
    );
    
    return card;
  } catch (error) {
    console.error('[Card Service] Error removing project from card:', error);
    throw new DatabaseError('Failed to remove project from card', error);
  }
}
}
