import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { GlobalRanking, IGlobalRanking } from '@/app/lib/models/GlobalRanking';
import { Card } from '@/app/lib/models/Card';

export async function GET() {
  try {
    await dbConnect();

    // First, recalculate global rankings
    await GlobalRanking.calculateRankings();

    // Get the top global rankings
    const globalRankings = await GlobalRanking.find({})
      .sort({ totalScore: -1, averageRank: 1, lastUpdated: -1 })
      .limit(50); // Limit to top 50

    if (!globalRankings || globalRankings.length === 0) {
      return NextResponse.json({
        rankings: [],
        message: 'No global rankings available yet. Complete some sessions to generate rankings!'
      });
    }

    // Fetch card details for each ranking
    const cardIds = globalRankings.map(ranking => ranking.cardId);
    const cards = await Card.find({ uuid: { $in: cardIds }, isActive: true });
    
    // Create a map for quick card lookup
    const cardMap = new Map();
    cards.forEach(card => {
      cardMap.set(card.uuid, {
        uuid: card.uuid,
        type: card.type,
        content: card.content
      });
    });

    // Combine rankings with card data
    const rankedCards = globalRankings
      .map((ranking, index) => {
        const card = cardMap.get(ranking.cardId);
        if (!card) return null; // Skip if card not found or inactive
        
        return {
          card,
          rank: index + 1,
          totalScore: ranking.totalScore,
          averageRank: ranking.averageRank,
          appearanceCount: ranking.appearanceCount
        };
      })
      .filter(Boolean); // Remove null entries

    return NextResponse.json({
      rankings: rankedCards,
      totalRanked: rankedCards.length,
      lastUpdated: globalRankings[0]?.lastUpdated || new Date()
    });

  } catch (error) {
    console.error('Failed to fetch global rankings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global rankings' },
      { status: 500 }
    );
  }
}

// Optional: POST endpoint to manually trigger ranking recalculation
export async function POST() {
  try {
    await dbConnect();
    
    // Recalculate global rankings
    await GlobalRanking.calculateRankings();
    
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
}
