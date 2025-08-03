import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { SESSION_FIELDS, API_FIELDS, PLAY_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';
import { forceCompletionCheckAndUpdate, validatePlayState } from '@/app/lib/utils/playCompletionUtils';

export async function GET(request: NextRequest) {
  try {
    // Note: sessionId parameter is actually playUuid in the new architecture
    const playUuid = request.nextUrl.searchParams.get(SESSION_FIELDS.ID);
    
    if (!playUuid || !validateSessionId(playUuid)) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Valid play ID is required' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Apply no-cache headers to response
    const noCacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Find play session and check if it's still valid (accept both active and completed)
    const play = await Play.findOne({ 
      [PLAY_FIELDS.UUID]: playUuid,
      [PLAY_FIELDS.STATUS]: { $in: ['active', 'completed'] },
      [PLAY_FIELDS.EXPIRES_AT]: { $gt: new Date() }
    });

    // Include version in the response for optimistic locking
    const version = play?.version || 0;

    console.log(`🔍 Play validation for ${playUuid.substring(0, 8)}...: ${play ? 'VALID' : 'INVALID'}`);

// Only force-complete plays that are in 'swiping' state and should be completed
    // Do NOT force-complete plays in 'voting' state as they have active voting processes
    if (play && play.status === 'active' && play.state === 'swiping') {
      const completionUpdated = await forceCompletionCheckAndUpdate(play);
      if (completionUpdated) {
        console.log(`🔄 Play ${play.playUuid} was stuck in swiping state and force-completed during validation`);
      }
    } else if (play && play.status === 'active' && play.state === 'voting') {
      console.log(`🗳️ Play ${play.playUuid} is in voting state - allowing voting process to complete naturally`);
    }

    const stateValidation = validatePlayState(play);
    if (!stateValidation.isValid) {
      console.warn(`⚠️ Play ${play.playUuid} has state inconsistencies:`, stateValidation.issues);
    }

    // Fetch actual card data if play exists and has deck cards
    let deckCards: any[] = [];
    if (play && play.deck && play.deck.length > 0) {
      try {
        // Fetch all cards for this play's deck using the UUIDs stored in play.deck
        const cards = await Card.find({ 
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
        
        console.log(`📋 Fetched ${deckCards.length} cards for play ${playUuid.substring(0, 8)}`);
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
        [SESSION_FIELDS.VERSION]: version,
        session: play ? {
          swipes: play.swipes || [],
          personalRanking: play.personalRanking || [],
          deckUuid: play.deckUuid,
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
}
