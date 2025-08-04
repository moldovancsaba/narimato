import { NextRequest, NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { API_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';
import { forceCompletionCheckAndUpdate, validatePlayState } from '@/app/lib/utils/playCompletionUtils';

export const GET = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    // Note: Accept both sessionId and sessionUUID for compatibility
    const uuid = request.nextUrl.searchParams.get('sessionId') || request.nextUrl.searchParams.get('sessionUUID');
    
    if (!uuid || !validateSessionId(uuid)) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Valid play ID is required' }),
        { status: 400 }
      );
    }
    
    // Use organization UUID for database connection
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();

    // Get models bound to this specific connection
    const PlayModel = connection.model('Play', Play.schema);
    const CardModel = connection.model('Card', Card.schema);

    // Apply no-cache headers to response
    const noCacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Find play session and check if it's still valid (accept both active and completed)
    const play = await PlayModel.findOne({ 
      uuid: uuid,
      status: { $in: ['active', 'completed'] },
      expiresAt: { $gt: new Date() }
    });

    // Include version in the response for optimistic locking
    const version = play?.version || 0;

    console.log(`🔍 Play validation for ${uuid.substring(0, 8)}...: ${play ? 'VALID' : 'INVALID'}`);

// Force-complete plays that should be completed regardless of state
    // This handles edge cases where plays get stuck in any state
    if (play && play.status === 'active') {
      const completionUpdated = await forceCompletionCheckAndUpdate(play);
      if (completionUpdated) {
        console.log(`🔄 Play ${play.uuid} was stuck in ${play.state} state and force-completed during validation`);
      } else if (play.state === 'voting') {
        console.log(`🗳️ Play ${play.uuid} is in voting state - allowing voting process to complete naturally`);
      }
    }

    // Only validate play state if play exists
    if (play) {
      const stateValidation = validatePlayState(play);
      if (!stateValidation.isValid) {
        console.warn(`⚠️ Play ${play.uuid} has state inconsistencies:`, stateValidation.issues);
      }
    }

    // Fetch actual card data if play exists and has deck cards
    let deckCards: any[] = [];
    if (play && play.deck && play.deck.length > 0) {
      try {
        // Fetch all cards for this play's deck using the UUIDs stored in play.deck
        const cards = await CardModel.find({ 
          uuid: { $in: play.deck },
          isActive: true 
        }).lean(); // Use lean() for better performance
        
        // Create a map for fast card lookup
        const cardMap = new Map();
        cards.forEach(card => {
          cardMap.set(card.uuid, card);
        });
        
        // Maintain exact deck order to match swipe API logic
        deckCards = play.deck.map((uuid: string) => cardMap.get(uuid)).filter(Boolean);
        
        console.log(`📋 Fetched ${deckCards.length} cards for play ${uuid.substring(0, 8)}`);
      } catch (cardError) {
        console.error('Error fetching deck cards:', cardError);
        // Continue without cards rather than failing completely
      }
    }

    return new NextResponse(
      JSON.stringify({ 
        isValid: !!play,
        state: play?.state || null,
        status: play?.status || null,
        version: version,
        session: play ? {
          swipes: play.swipes || [],
          personalRanking: play.personalRanking || [],
          deckUUID: play.deckUUID,
          deckTag: play.deckTag,
          deck: deckCards // Include actual card data
        } : null
      }),
      { 
        status: 200,
        headers: noCacheHeaders
      }
    );
  } catch (error) {
    console.error('Play validation error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
});
