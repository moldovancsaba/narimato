import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { Play } from '@/app/lib/models/Play';
import { savePlayResults } from '@/app/lib/utils/sessionResultsUtils';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionUUID = searchParams.get('sessionUUID') || searchParams.get('playUUID') || searchParams.get('sessionId');

  try {
    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationUUID = orgContext?.organizationUUID || 'default';

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Register connection-specific models
    const SessionResultsModel = connection.model('SessionResults', SessionResults.schema);
    const PlayModel = connection.model('Play', Play.schema);

    if (!sessionUUID) {
      return NextResponse.json(
        { error: 'Valid session UUID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching play results for sessionUUID: ${sessionUUID}`);

    // Try to find saved play results first
    const savedResults = await SessionResultsModel.findOne({ [SESSION_FIELDS.UUID]: sessionUUID });

    if (savedResults) {
      console.log(`Found saved results for session ${sessionUUID}`);
      return NextResponse.json({
        personalRanking: savedResults.personalRanking,
        statistics: savedResults.sessionStatistics,
        isShared: true,
        createdAt: savedResults.createdAt,
        updatedAt: savedResults.updatedAt
      });
    }

    console.log(`No saved results found for session ${sessionUUID}, checking live play...`);

    // If no saved results found, try to get from live play and save
    const livePlay = await PlayModel.findOne({ uuid: sessionUUID });

    if (livePlay) {
      console.log(`Found live play for ${sessionUUID}:`, {
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
      console.log(`No live play found with UUID: ${sessionUUID}`);
    }

    if (livePlay && livePlay.status === 'completed') {
      // Try to save the play results now with race condition handling
      try {
        await savePlayResults(livePlay, connection);
        console.log(`✓ Results saved for session ${sessionUUID}`);
      } catch (saveError: any) {
        // Handle duplicate key error gracefully - it means results were already saved by another request
        if (saveError.code === 11000) {
          console.log(`⚠️ Results already exist for session ${sessionUUID} (race condition handled)`);
        } else {
          console.error(`Failed to save session results for ${sessionUUID}:`, saveError);
        }
      }
      
      // Always try to fetch the saved results (they should exist now)
      const newlySavedResults = await SessionResultsModel.findOne({ [SESSION_FIELDS.UUID]: sessionUUID });
      if (newlySavedResults) {
        console.log(`Successfully retrieved results for session ${sessionUUID}`);
        return NextResponse.json({
          personalRanking: newlySavedResults.personalRanking,
          statistics: newlySavedResults.sessionStatistics,
          isShared: true,
          createdAt: newlySavedResults.createdAt,
          updatedAt: newlySavedResults.updatedAt
        });
      } else {
        console.error(`Results not found after save attempt for session ${sessionUUID}`);
      }
    }

    // If no saved results found, return detailed error information
    console.log(`Session ${sessionUUID} not found in either saved results or live sessions`);
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
