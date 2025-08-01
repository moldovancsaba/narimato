import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
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

    // Find play session and check if it's still valid (accept both active and completed)
    const play = await Play.findOne({ 
      [PLAY_FIELDS.UUID]: playUuid,
      [PLAY_FIELDS.STATUS]: { $in: ['active', 'completed'] },
      [PLAY_FIELDS.EXPIRES_AT]: { $gt: new Date() }
    });

    // Include version in the response for optimistic locking
    const version = play?.version || 0;

    console.log(`🔍 Play validation for ${playUuid.substring(0, 8)}...: ${play ? 'VALID' : 'INVALID'}`);

if (play && play.status === 'active') {
      const completionUpdated = await forceCompletionCheckAndUpdate(play);
      if (completionUpdated) {
        console.log(`🔄 Play ${play.playUuid} was stuck and force-completed during validation`);
      }
    }

    const stateValidation = validatePlayState(play);
    if (!stateValidation.isValid) {
      console.warn(`⚠️ Play ${play.playUuid} has state inconsistencies:`, stateValidation.issues);
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
          deckTag: play.deckTag
        } : null
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Play validation error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
}
