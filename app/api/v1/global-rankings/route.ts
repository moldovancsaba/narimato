import { NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { GlobalRanking, IGlobalRanking } from '@/app/lib/models/GlobalRanking';
import { Card } from '@/app/lib/models/Card';
import { Play } from '@/app/lib/models/Play';
import { VOTE_FIELDS } from '@/app/lib/constants/fieldNames';
import { calculateRankingsWithConnection } from '@/app/lib/utils/rankingCalculation';

export const GET = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();

    // Use connection-specific models
    const GlobalRankingModel = connection.model('GlobalRanking', GlobalRanking.schema);
    const CardModel = connection.model('Card', Card.schema);

    // Get deck filter from URL search params
    const { searchParams } = new URL(request.url);
    const deckTag = searchParams.get('deck');

    // First, recalculate global rankings using connection-specific models
    await calculateRankingsWithConnection(connection);

    // Get card IDs based on deck filter
    let cardFilter: any = { isActive: true };
    if (deckTag) {
      // Only show child cards (cards that have the deckTag in their hashtags array)
      // Exclude the parent card itself (whose name matches the deckTag)
      cardFilter = { 
        ...cardFilter, 
        hashtags: deckTag // Only child cards with this tag in their hashtags array
      };
    }

    const filteredCards = await CardModel.find(cardFilter, { uuid: 1 });
    const filteredCardIds = filteredCards.map(card => card.uuid);

    if (filteredCardIds.length === 0) {
      const response = NextResponse.json({
        rankings: [],
        deckTag,
        message: deckTag 
          ? `No rankings available for deck "${deckTag}" yet. Complete some sessions to generate rankings!`
          : 'No global rankings available yet. Complete some sessions to generate rankings!'
      });
      
      // Add cache control headers
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }

    // Get the top global rankings for the filtered cards, sorted by ELO rating
    const globalRankings = await GlobalRankingModel.find({ cardUUID: { $in: filteredCardIds } })
      .sort({ eloRating: -1, winRate: -1, totalGames: -1, lastUpdated: -1 })
      .limit(50); // Limit to top 50

    if (!globalRankings || globalRankings.length === 0) {
      const response = NextResponse.json({
        rankings: [],
        deckTag,
        message: deckTag 
          ? `No rankings available for deck "${deckTag}" yet. Complete some sessions to generate rankings!`
          : 'No global rankings available yet. Complete some sessions to generate rankings!'
      });
      
      // Add cache control headers
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }

    // Fetch card details for each ranking
    const cardIds = globalRankings.map(ranking => ranking.cardUUID);
    const cards = await CardModel.find({ uuid: { $in: cardIds }, isActive: true });
    
    // Create a map for quick card lookup
    const cardMap = new Map();
    cards.forEach(card => {
      // Derive type from card content - if it has imageUrl it's media, otherwise text
      const cardType = card.body?.imageUrl ? 'media' : 'text';
      
      cardMap.set(card.uuid, {
        uuid: card.uuid,
        type: cardType,
        content: {
          text: card.body?.textContent,
          mediaUrl: card.body?.imageUrl,
          cardSize: card.cardSize // Include cardSize for proper aspect ratio
        }
      });
    });

    // Combine rankings with card data
    const rankedCards = globalRankings
      .map((ranking, index) => {
        const card = cardMap.get(ranking.cardUUID);
        if (!card) return null; // Skip if card not found or inactive
        
        return {
          card,
          rank: index + 1,
          eloRating: ranking.eloRating,
          wins: ranking.wins,
          losses: ranking.losses,
          totalGames: ranking.totalGames,
          winRate: ranking.winRate,
          // Legacy fields (kept for compatibility)
          totalScore: ranking.totalScore,
          averageRank: ranking.averageRank,
          appearanceCount: ranking.appearanceCount
        };
      })
      .filter(Boolean); // Remove null entries

    const response = NextResponse.json({
      rankings: rankedCards,
      deckTag,
      totalRanked: rankedCards.length,
      lastUpdated: globalRankings[0]?.lastUpdated || new Date()
    });
    
    // Add cache control headers for mobile browsers
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('Failed to fetch global rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global rankings' },
      { status: 500 }
    );
  }
});

// Optional: POST endpoint to manually trigger ranking recalculation
export const POST = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();

    // Use connection-specific model
    const GlobalRankingModel = connection.model('GlobalRanking', GlobalRanking.schema);
    
    // Recalculate global rankings using connection-specific models
    await calculateRankingsWithConnection(connection);
    
    return NextResponse.json({
      success: true,
      message: 'Global rankings recalculated successfully'
    });

  } catch (error) {
    console.error('Failed to recalculate global rankings:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate global rankings' },
      { status: 500 }
    );
  }
});
