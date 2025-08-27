import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionUUID = searchParams.get('session') || searchParams.get('sessionId') || searchParams.get('sessionUUID');

    if (!sessionUUID) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Session UUID is required',
          errorCode: 'MISSING_SESSION_UUID',
          details: 'A valid session UUID must be provided to retrieve results.',
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
    const organizationUUID = orgContext?.organizationUUID || 'default';

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Register connection-specific models - Use Play model instead of Session
    const PlayModel = connection.model('Play', Play.schema);
    const CardModel = connection.model('Card', Card.schema);

    // Find the play session by UUID
    const play = await PlayModel.findOne({ uuid: sessionUUID });
    if (!play) {
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
    const rankedCardIds = play.personalRanking;
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
          name: card.name,
          body: card.body,
          title: card.name || ''
        } : null
      };
    }).filter((item: any) => item.card !== null);

    // Calculate session statistics
    const totalSwipes = play.swipes?.length || 0;
    const rightSwipes = play.swipes?.filter((swipe: any) => swipe.direction === 'right').length || 0;
    const leftSwipes = play.swipes?.filter((swipe: any) => swipe.direction === 'left').length || 0;
    const totalVotes = play.votes?.length || 0;
    
    const sessionStart = new Date(play.createdAt);
    const sessionEnd = play.completedAt ? new Date(play.completedAt) : new Date();
    const sessionDuration = Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 1000); // in seconds

    const statistics = {
      totalCards: play.deck?.length || 0,
      cardsRanked: personalRanking.length,
      cardsDiscarded: leftSwipes,
      totalSwipes,
      rightSwipes,
      leftSwipes,
      totalVotes,
      completionRate: play.deck?.length ? Math.round((totalSwipes / play.deck.length) * 100) : 0,
      sessionDuration,
      averageVotesPerCard: personalRanking.length > 1 ? Math.round(totalVotes / (personalRanking.length - 1)) : 0
    };

    return new NextResponse(
      JSON.stringify({
        sessionUUID,
        personalRanking,
        statistics,
        sessionInfo: {
          status: play.status,
          state: play.state,
          createdAt: play.createdAt,
          completedAt: play.completedAt,
          lastActivity: play.lastActivity
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
