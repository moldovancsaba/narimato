import { Card } from '@/app/lib/models/Card';
import { SessionResults } from '@/app/lib/models/SessionResults';

/**
 * Utility function to save session results to the SessionResults collection
 * This is used when a session is completed to create shareable results
 */
export const saveSessionResults = async (session: any) => {
  try {
    // Get all cards from the personal ranking with their details
    const cardIds = session.personalRanking || [];
    const cards = await Card.find({ uuid: { $in: cardIds } });
    
    // Create a map for quick card lookup
    const cardMap = new Map();
    cards.forEach(card => {
      cardMap.set(card.uuid, {
        uuid: card.uuid,
        type: card.type,
        content: card.content,
        title: card.title
      });
    });

    // Build the personal ranking with card details
    const personalRankingWithDetails = cardIds.map((cardId: string, index: number) => {
      const card = cardMap.get(cardId);
      return {
        cardId,
        card,
        rank: index + 1
      };
    }).filter((item: any) => item.card); // Filter out any cards that weren't found

    // Calculate session statistics
    const sessionStatistics = {
      totalCards: session.totalCards || 0,
      cardsRanked: session.personalRanking?.length || 0,
      cardsDiscarded: (session.totalCards || 0) - (session.personalRanking?.length || 0),
      totalSwipes: session.swipes?.length || 0,
      totalVotes: session.votes?.length || 0,
      completionRate: session.totalCards ? Math.round(((session.personalRanking?.length || 0) / session.totalCards) * 100) : 0
    };

    // Check if results already exist for this session
    const existingResults = await SessionResults.findOne({ sessionId: session.sessionId });
    
    if (existingResults) {
      // Update existing results
      existingResults.personalRanking = personalRankingWithDetails;
      existingResults.sessionStatistics = sessionStatistics;
      existingResults.updatedAt = new Date();
      await existingResults.save();
      console.log(`Updated existing session results for ${session.sessionId}`);
    } else {
      // Create new session results
      const sessionResults = new SessionResults({
        sessionId: session.sessionId,
        personalRanking: personalRankingWithDetails,
        sessionStatistics,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await sessionResults.save();
      console.log(`Created new session results for ${session.sessionId}`);
    }
  } catch (error) {
    console.error(`Failed to save session results for ${session.sessionId}:`, error);
    throw error; // Re-throw so callers can handle appropriately
  }
};

/**
 * Utility function to save play results to the SessionResults collection
 * This is used when a play is completed to create shareable results
 */
export const savePlayResults = async (play: any) => {
  try {
    // Get all cards from the personal ranking with their details
    const cardIds = play.personalRanking || [];
    const cards = await Card.find({ uuid: { $in: cardIds } });
    
    // Create a map for quick card lookup
    const cardMap = new Map();
    cards.forEach(card => {
      cardMap.set(card.uuid, {
        uuid: card.uuid,
        type: card.type,
        content: card.content,
        title: card.title
      });
    });

    // Build the personal ranking with card details
    const personalRankingWithDetails = cardIds.map((cardId: string, index: number) => {
      const card = cardMap.get(cardId);
      return {
        cardId,
        card,
        rank: index + 1
      };
    }).filter((item: any) => item.card); // Filter out any cards that weren't found

    // Calculate play statistics
    const playStatistics = {
      totalCards: play.totalCards || 0,
      cardsRanked: play.personalRanking?.length || 0,
      cardsDiscarded: (play.totalCards || 0) - (play.personalRanking?.length || 0),
      totalSwipes: play.swipes?.length || 0,
      totalVotes: play.votes?.length || 0,
      completionRate: play.totalCards ? Math.round(((play.personalRanking?.length || 0) / play.totalCards) * 100) : 0
    };

    // Use atomic upsert to handle race conditions
    const result = await SessionResults.findOneAndUpdate(
      { sessionId: play.playUuid },
      {
        $set: {
          personalRanking: personalRankingWithDetails,
          sessionStatistics: playStatistics,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { 
        upsert: true, 
        new: true 
      }
    );
    
    if (result) {
      console.log(`✓ Play results saved/updated atomically for ${play.playUuid}`);
    } else {
      console.warn(`⚠️ Failed to save play results for ${play.playUuid}`);
    }
  } catch (error) {
    console.error(`Failed to save play results for ${play.playUuid}:`, error);
    throw error; // Re-throw so callers can handle appropriately
  }
};
