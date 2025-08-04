import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Session ID is required',
          errorCode: 'MISSING_SESSION_ID',
          details: 'A valid session ID must be provided to retrieve results.',
          suggestions: [
            'Complete a voting session first',
            'Check that you\'re accessing this from a completed session',
            'Try starting a new session'
          ]
        }),
        { status: 400 }
      );
    }

    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Register connection-specific models
    const SessionModel = connection.model('Session', Session.schema);
    const CardModel = connection.model('Card', Card.schema);

    // Find the session
    const session = await SessionModel.findOne({ sessionId });
    if (!session) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Session not found',
          errorCode: 'SESSION_NOT_FOUND',
          details: 'This session may have expired or never existed. Live sessions are temporary and may not be available after some time.',
          suggestions: [
            'Try completing a new session',
            'Check if the session ID is correct',
            'Recent sessions may take a moment to become available'
          ]
        }),
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
    const cards = await CardModel.find({ uuid: { $in: rankedCardIds } });
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
