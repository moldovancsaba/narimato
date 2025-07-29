import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return new NextResponse(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the session
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404 }
      );
    }

    // Get the personal ranking with card details
    const rankedCardIds = session.personalRanking;
    if (!rankedCardIds || rankedCardIds.length === 0) {
      return new NextResponse(
        JSON.stringify({
          personalRanking: [],
          statistics: {
            totalCards: 0,
            cardsRanked: 0,
            cardsDiscarded: 0,
            completionRate: 0,
            sessionDuration: 0
          }
        }),
        { status: 200 }
      );
    }

    // Fetch card details for all ranked cards
    const cards = await Card.find({ uuid: { $in: rankedCardIds } });
    const cardMap = new Map(cards.map(card => [card.uuid, card]));

    // Build the ranking with card details
    const personalRanking = rankedCardIds.map((cardId: string, index: number) => {
      const card = cardMap.get(cardId);
      return {
        rank: index + 1,
        cardId,
        card: card ? {
          uuid: card.uuid,
          type: card.type,
          content: card.content,
          title: card.title || ''
        } : null
      };
    }).filter((item: any) => item.card !== null);

    // Calculate session statistics
    const totalSwipes = session.swipes?.length || 0;
    const rightSwipes = session.swipes?.filter((swipe: any) => swipe.direction === 'right').length || 0;
    const leftSwipes = session.swipes?.filter((swipe: any) => swipe.direction === 'left').length || 0;
    const totalVotes = session.votes?.length || 0;
    
    const sessionStart = new Date(session.createdAt);
    const sessionEnd = session.completedAt ? new Date(session.completedAt) : new Date();
    const sessionDuration = Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 1000); // in seconds

    const statistics = {
      totalCards: session.deck?.length || 0,
      cardsRanked: personalRanking.length,
      cardsDiscarded: leftSwipes,
      totalSwipes,
      rightSwipes,
      leftSwipes,
      totalVotes,
      completionRate: session.deck?.length ? Math.round((totalSwipes / session.deck.length) * 100) : 0,
      sessionDuration,
      averageVotesPerCard: personalRanking.length > 1 ? Math.round(totalVotes / (personalRanking.length - 1)) : 0
    };

    return new NextResponse(
      JSON.stringify({
        sessionId,
        personalRanking,
        statistics,
        sessionInfo: {
          status: session.status,
          state: session.state,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          lastActivity: session.lastActivity
        }
      }),
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Session results error:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to fetch session results'
      }),
      { status: 500 }
    );
  }
}
