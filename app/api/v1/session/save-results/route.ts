import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const sessionId = body[SESSION_FIELDS.ID];
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get the completed session from the database
    const session = await Session.findOne({ sessionId }).populate('personalRanking');
    
    if (!session || session.status !== 'completed') {
      return NextResponse.json(
        { error: 'Session not found or not completed' },
        { status: 404 }
      );
    }

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
    const existingResults = await SessionResults.findOne({ sessionId });
    
    if (existingResults) {
      // Update existing results
      existingResults.personalRanking = personalRankingWithDetails;
      existingResults.sessionStatistics = sessionStatistics;
      existingResults.updatedAt = new Date();
      await existingResults.save();
      
      return NextResponse.json({
        success: true,
        sessionId,
        message: 'Session results updated successfully',
        shareableUrl: `/completed?sessionId=${sessionId}`
      });
    } else {
      // Create new session results
      const sessionResults = new SessionResults({
        sessionId,
        personalRanking: personalRankingWithDetails,
        sessionStatistics,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await sessionResults.save();

      return NextResponse.json({
        success: true,
        sessionId,
        message: 'Session results saved successfully',
        shareableUrl: `/completed?sessionId=${sessionId}`
      });
    }

  } catch (error) {
    console.error('Failed to save session results:', error);
    return NextResponse.json(
      { error: 'Failed to save session results' },
      { status: 500 }
    );
  }
}
