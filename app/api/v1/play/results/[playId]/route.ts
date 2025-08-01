import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { Play } from '@/app/lib/models/Play';
import { PLAY_FIELDS } from '@/app/lib/constants/fieldNames';
import { savePlayResults } from '@/app/lib/utils/sessionResultsUtils';

interface RouteParams {
  params: Promise<{ playId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  const { playId } = await context.params;
  try {
    await dbConnect();

    if (!playId) {
      return NextResponse.json(
        { error: 'Valid play ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching play results for playId: ${playId}`);

    // Try to find saved play results first
    const savedResults = await SessionResults.findOne({ sessionId: playId });

    if (savedResults) {
      console.log(`Found saved results for play ${playId}`);
      return NextResponse.json({
        personalRanking: savedResults.personalRanking,
        statistics: savedResults.sessionStatistics,
        isShared: true,
        createdAt: savedResults.createdAt,
        updatedAt: savedResults.updatedAt
      });
    }

    console.log(`No saved results found for play ${playId}, checking live play...`);

    // If no saved results found, try to get from live play and save
    const livePlay = await Play.findOne({ [PLAY_FIELDS.UUID]: playId });

    if (livePlay) {
      console.log(`Found live play for ${playId}:`, {
        status: livePlay.status,
        state: livePlay.state,
        personalRanking: livePlay.personalRanking?.length || 0,
        swipes: livePlay.swipes?.length || 0,
        votes: livePlay.votes?.length || 0
      });
      
      if (livePlay.status === 'completed') {
        console.log(`Play is completed, attempting to save results...`);
      } else {
        console.log(`Play is not completed (status: ${livePlay.status}), cannot retrieve results yet`);
        return NextResponse.json(
          {
            error: 'Play not completed yet',
            errorCode: 'PLAY_NOT_COMPLETED',
            details: `This play is still in progress (status: ${livePlay.status}, state: ${livePlay.state}).`,
            suggestions: [
              'Complete the play by swiping through all cards',
              'Check if the play session has been properly finished'
            ]
          },
          { status: 404 }
        );
      }
    } else {
      console.log(`No live play found with UUID: ${playId}`);
    }

    if (livePlay && livePlay.status === 'completed') {

      // Try to save the play results now with race condition handling
      try {
        await savePlayResults(livePlay);
        console.log(`✓ Results saved for play ${playId}`);
      } catch (saveError: any) {
        // Handle duplicate key error gracefully - it means results were already saved by another request
        if (saveError.code === 11000) {
          console.log(`⚠️ Results already exist for play ${playId} (race condition handled)`);
        } else {
          console.error(`Failed to save play results for ${playId}:`, saveError);
        }
      }
      
      // Always try to fetch the saved results (they should exist now)
      const newlySavedResults = await SessionResults.findOne({ sessionId: playId });
      if (newlySavedResults) {
        console.log(`Successfully retrieved results for play ${playId}`);
        return NextResponse.json({
          personalRanking: newlySavedResults.personalRanking,
          statistics: newlySavedResults.sessionStatistics,
          isShared: true,
          createdAt: newlySavedResults.createdAt,
          updatedAt: newlySavedResults.updatedAt
        });
      } else {
        console.error(`Results not found after save attempt for play ${playId}`);
      }
    }

    // If no saved results found, return detailed error information
    console.log(`Play ${playId} not found in either saved results or live plays`);
    return NextResponse.json(
      {
        error: 'Play results not found or not shareable',
        errorCode: 'PLAY_NOT_FOUND',
        details: 'This play may have expired, was never completed, or the results have not been saved yet.',
        suggestions: [
          'Try completing a new play',
          'Check if the play link is correct',
          'The play may need a few moments to process results'
        ]
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('Failed to fetch play results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch play results' },
      { status: 500 }
    );
  }
}

