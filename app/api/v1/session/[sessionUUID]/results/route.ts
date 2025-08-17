import { NextRequest, NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { API_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';

// FUNCTIONAL: Fetch session results for a completed play session
// STRATEGIC: Enable users to view their personalized ranking results after completion
export const GET = createOrgAwareRoute(async (request, { organizationUUID }, routeContext) => {
  try {
    // FUNCTIONAL: Extract session UUID from route params
    // STRATEGIC: Handle both direct params and route context structures
    const params = await (routeContext?.params || routeContext);
    const sessionUUID = params?.sessionUUID;
    
    if (!sessionUUID) {
      return new NextResponse(
        JSON.stringify({ error: 'Session UUID is required' }),
        { status: 400 }
      );
    }
    
    // FUNCTIONAL: Validate the session UUID parameter
    // STRATEGIC: Prevent invalid requests from reaching the database
    if (!sessionUUID || !validateSessionId(sessionUUID)) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Valid session UUID is required' }),
        { status: 400 }
      );
    }

    // FUNCTIONAL: Connect to organization-specific database
    // STRATEGIC: Multi-tenant architecture requires per-organization database isolation
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Register connection-specific models
    const PlayModel = connection.model('Play', Play.schema);
    const CardModel = connection.model('Card', Card.schema);

    // FUNCTIONAL: Find the play session (accept both active and completed)
    // STRATEGIC: Allow results viewing for active sessions to show intermediate rankings
    const play = await PlayModel.findOne({ 
      uuid: sessionUUID,
      status: { $in: ['active', 'completed'] }
    });
    
    if (!play) {
      return new NextResponse(
        JSON.stringify({ 
          [API_FIELDS.ERROR]: 'Session not found',
          details: 'This session may have expired or never existed.'
        }),
        { status: 404 }
      );
    }

    console.log(`📋 Results requested for session ${sessionUUID.substring(0, 8)}... (${play.status})`);

    // FUNCTIONAL: Get the personal ranking with card details
    // STRATEGIC: Provide complete card information for results display
    const rankedCardIds = play.personalRanking || [];
    
    if (rankedCardIds.length === 0) {
      return new NextResponse(
        JSON.stringify({
          sessionUUID,
          personalRanking: [],
          statistics: {
            totalCards: play.deck?.length || 0,
            cardsRanked: 0,
            cardsDiscarded: 0,
            completionRate: 0,
            sessionDuration: 0
          },
          sessionInfo: {
            status: play.status,
            state: play.state,
            createdAt: play.createdAt,
            completedAt: play.completedAt,
            lastActivity: play.lastActivity
          }
        }),
        { status: 200 }
      );
    }

    // FUNCTIONAL: Fetch card details for all ranked cards
    // STRATEGIC: Provide rich card information for results presentation
    const cards = await CardModel.find({ uuid: { $in: rankedCardIds } }).lean();
    const cardMap = new Map(cards.map(card => [card.uuid, card]));

    // FUNCTIONAL: Build the ranking with card details
    // STRATEGIC: Create user-friendly ranking display with card information
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

    // FUNCTIONAL: Calculate session statistics
    // STRATEGIC: Provide meaningful metrics about the ranking session
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

    // FUNCTIONAL: Return comprehensive results data
    // STRATEGIC: Provide all information needed for results page display
    return new NextResponse(
      JSON.stringify({
        sessionUUID,
        personalRanking,
        statistics,
        sessionInfo: {
          status: play.status,
          state: play.state,
          deckTag: play.deckTag,
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
        [API_FIELDS.ERROR]: 'Internal server error',
        message: 'Failed to fetch session results'
      }),
      { status: 500 }
    );
  }
});
