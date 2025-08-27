import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { Play } from '@/app/lib/models/Play';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';
import { saveSessionResults, savePlayResults } from '@/app/lib/utils/sessionResultsUtils';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

interface RouteParams {
  params: Promise<{ sessionUUID: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  const { sessionUUID } = await context.params;
  try {
    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationId = orgContext?.organizationId || 'default';
    
    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Get models bound to this specific connection
    const PlayModel = connection.model('Play', Play.schema);
    const SessionResultsModel = connection.model('SessionResults', SessionResults.schema);
    
    if (!sessionUUID || !validateSessionId(sessionUUID)) {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching session results for sessionUUID: ${sessionUUID}`);

    // Try to find saved session results first
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
    
    if (livePlay && livePlay.status === 'completed') {
      console.log(`Found completed live play for ${sessionUUID}, attempting to save results...`);
      
      // Try to save the play results now
      try {
        await savePlayResults(livePlay, connection);
        
        // Retry fetching the saved results
        const newlySavedResults = await SessionResultsModel.findOne({ [SESSION_FIELDS.UUID]: sessionUUID });
        if (newlySavedResults) {
          console.log(`Successfully saved and retrieved results for play ${sessionUUID}`);
          return NextResponse.json({
            personalRanking: newlySavedResults.personalRanking,
            statistics: newlySavedResults.sessionStatistics,
            isShared: true,
            createdAt: newlySavedResults.createdAt,
            updatedAt: newlySavedResults.updatedAt
          });
        }
      } catch (saveError) {
        console.error(`Failed to save play results for ${sessionUUID}:`, saveError);
        // Don't return error here, continue to check other options
      }
    }

    // If no saved results found, return detailed error information
    console.log(`Session ${sessionUUID} not found in either saved results or live sessions`);
    return NextResponse.json(
      { 
        error: 'Session results not found or not shareable',
        errorCode: 'SESSION_NOT_FOUND',
        details: 'This session may have expired, was never completed, or the results have not been saved yet.',
        suggestions: [
          'Try completing a new session',
          'Check if the session link is correct',
          'The session may need a few moments to process results'
        ]
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('Failed to fetch session results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session results' },
      { status: 500 }
    );
  }
}
