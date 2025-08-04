import { createOrgDbConnect } from './db';
import { Card, ICard } from '../models/Card';
import { DECK_RULES } from '../constants/fieldNames';

/**
 * Card Hierarchy Utilities for Multi-Level Card System
 * 
 * This system allows cards to form natural hierarchies through hashtag relationships:
 * - Cards with no hashtags are ROOT DECKS
 * - Cards with hashtags are CHILDREN of those hashtag cards
 * - Cards that have children are PLAYABLE DECKS
 */

/**
 * Get all children of a card (cards that have this card's name in their hashtags)
 * @param cardName The #HASHTAG name of the parent card
 * @returns Array of child cards
 */
export async function getChildren(organizationId: string, cardName: string): Promise<ICard[]> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  // Ensure cardName starts with #
  const hashtag = cardName.startsWith('#') ? cardName : `#${cardName}`;
  
  return await CardModel.find({
    hashtags: hashtag,
    isActive: true
  }).sort({ createdAt: -1 });
}

/**
 * Get all parents of a card (cards whose names are in this card's hashtags)
 * @param card The card to find parents for
 * @returns Array of parent cards
 */
export async function getParents(organizationId: string, card: ICard): Promise<ICard[]> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  if (!card.hashtags || card.hashtags.length === 0) {
    return []; // No parents
  }
  
  return await CardModel.find({
    name: { $in: card.hashtags },
    isActive: true
  });
}

/**
 * Check if a card is playable (has enough children for a meaningful ranking experience)
 * @param cardName The #HASHTAG name of the card
 * @returns True if the card has sufficient children for playable ranking, false otherwise
 */
export async function isPlayable(organizationId: string, cardName: string): Promise<boolean> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  const hashtag = cardName.startsWith('#') ? cardName : `#${cardName}`;
  
  const childCount = await CardModel.countDocuments({
    hashtags: hashtag,
    isActive: true
  });
  
  // Enforce minimum card threshold to ensure meaningful ranking experience
  // A deck with only 1 card cannot be compared/ranked meaningfully
  return childCount >= DECK_RULES.MIN_CARDS_FOR_PLAYABLE;
}

/**
 * Get all root deck cards (cards with no hashtags)
 * @returns Array of root deck cards
 */
export async function getRootDecks(organizationId: string): Promise<ICard[]> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  return await CardModel.find({
    $or: [
      { hashtags: { $exists: false } },
      { hashtags: { $size: 0 } }
    ],
    isActive: true
  }).sort({ createdAt: -1 });
}

/**
 * Get all playable cards (cards that have children)
 * @returns Array of playable cards with their child count
 */
export async function getPlayableCards(organizationId: string): Promise<Array<ICard & { childCount: number }>> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  // Aggregate to find cards that have children
  const pipeline = [
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'cards',
        let: { cardName: '$name' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$$cardName', '$hashtags'] },
                  { $eq: ['$isActive', true] }
                ]
              }
            }
          }
        ],
        as: 'children'
      }
    },
    {
      $addFields: {
        childCount: { $size: '$children' }
      }
    },
    {
      $match: {
        // Only include decks with sufficient cards for meaningful ranking experience
        // This prevents showing decks with too few cards (e.g., single-card decks)
        childCount: { $gte: DECK_RULES.MIN_CARDS_FOR_PLAYABLE }
      }
    },
    {
      $project: {
        children: 0 // Remove the children array, keep only the count
        // Note: All other fields are automatically included in MongoDB aggregation
        // unless explicitly excluded. cardSize will be included automatically.
      }
    },
    { $sort: { createdAt: -1 as const } }
  ];
  
  return await CardModel.aggregate(pipeline);
}

/**
 * Get the complete hierarchy tree starting from root decks
 * @returns Nested tree structure of all cards
 */
export async function getHierarchyTree(organizationId: string): Promise<any[]> {
  const connectDb = createOrgDbConnect(organizationId);
  await connectDb();
  
  const rootDecks = await getRootDecks(organizationId);
  
  async function buildTree(cards: ICard[]): Promise<any[]> {
    const result = [];
    
    for (const card of cards) {
      const children = await getChildren(organizationId, card.name);
      const cardWithChildren = {
        ...card.toObject(),
        children: children.length > 0 ? await buildTree(children) : [],
        isPlayable: children.length > 0
      };
      result.push(cardWithChildren);
    }
    
    return result;
  }
  
  return await buildTree(rootDecks);
}

/**
 * Validate hashtag format
 * @param hashtag The hashtag to validate
 * @returns True if valid, false otherwise
 */
export function isValidHashtag(hashtag: string): boolean {
  return hashtag.startsWith('#') && hashtag.length > 1 && /^#[A-Z0-9_-]+$/i.test(hashtag);
}

/**
 * Get all available hashtags from existing cards (for hashtag selection)
 * @returns Array of available hashtag names
 */
export async function getAvailableHashtags(organizationId: string): Promise<string[]> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  const cards = await CardModel.find({ isActive: true }, { name: 1 });
  return cards.map(card => card.name).sort();
}

/**
 * Check if a hashtag name is already taken
 * @param name The hashtag name to check
 * @returns True if taken, false if available
 */
export async function isHashtagTaken(organizationId: string, name: string): Promise<boolean> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  const hashtag = name.startsWith('#') ? name : `#${name}`;
  const existingCard = await CardModel.findOne({ name: hashtag, isActive: true });
  return !!existingCard;
}

/**
 * Rename a hashtag and update all references
 * @param oldName The current hashtag name
 * @param newName The new hashtag name
 * @returns Number of cards updated
 */
export async function renameHashtag(organizationId: string, oldName: string, newName: string): Promise<number> {
  const connectDb = createOrgDbConnect(organizationId);
  const connection = await connectDb();
  
  // Get Card model bound to this specific connection
  const CardModel = connection.model('Card', Card.schema);
  
  const oldHashtag = oldName.startsWith('#') ? oldName : `#${oldName}`;
  const newHashtag = newName.startsWith('#') ? newName : `#${newName}`;
  
  // Start a transaction
  const session = await connection.startSession();
  session.startTransaction();
  
  try {
    // Update the card with this name
    await CardModel.updateOne(
      { name: oldHashtag },
      { name: newHashtag, updatedAt: new Date() },
      { session }
    );
    
    // Update all cards that reference this hashtag
    const result = await CardModel.updateMany(
      { hashtags: oldHashtag },
      { 
        $set: { 
          'hashtags.$': newHashtag,
          updatedAt: new Date()
        }
      },
      { session }
    );
    
    await session.commitTransaction();
    return result.modifiedCount + 1; // +1 for the main card
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
