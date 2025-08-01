import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { Session } from '@/app/lib/models/Session';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';
import { saveSessionResults } from '@/app/lib/utils/sessionResultsUtils';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  const { sessionId } = await context.params;
  try {
    await dbConnect();
    
    if (!sessionId || !validateSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching session results for sessionId: ${sessionId}`);

    // Try to find saved session results first
    const savedResults = await SessionResults.findOne({ sessionId });
    
    if (savedResults) {
      console.log(`Found saved results for session ${sessionId}`);
      return NextResponse.json({
        personalRanking: savedResults.personalRanking,
        statistics: savedResults.sessionStatistics,
        isShared: true,
        createdAt: savedResults.createdAt,
        updatedAt: savedResults.updatedAt
      });
    }

    console.log(`No saved results found for session ${sessionId}, checking live session...`);
    
    // If no saved results found, try to get from live session and save
    const liveSession = await Session.findOne({ sessionId });
    
    if (liveSession && liveSession.status === 'completed') {
      console.log(`Found completed live session for ${sessionId}, attempting to save results...`);
      
      // Try to save the session results now
      try {
        await saveSessionResults(liveSession);
        
        // Retry fetching the saved results
        const newlySavedResults = await SessionResults.findOne({ sessionId });
        if (newlySavedResults) {
          console.log(`Successfully saved and retrieved results for session ${sessionId}`);
          return NextResponse.json({
            personalRanking: newlySavedResults.personalRanking,
            statistics: newlySavedResults.sessionStatistics,
            isShared: true,
            createdAt: newlySavedResults.createdAt,
            updatedAt: newlySavedResults.updatedAt
          });
        }
      } catch (saveError) {
        console.error(`Failed to save session results for ${sessionId}:`, saveError);
        // Don't return error here, continue to check other options
      }
    }

    // If no saved results found, return detailed error information
    console.log(`Session ${sessionId} not found in either saved results or live sessions`);
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
