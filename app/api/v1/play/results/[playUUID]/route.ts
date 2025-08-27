import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { Play } from '@/app/lib/models/Play';
import { savePlayResults } from '@/app/lib/utils/sessionResultsUtils';
import { SESSION_FIELDS, PLAY_FIELDS } from '@/app/lib/constants/fieldNames';

interface RouteParams {
  params: Promise<{ playUUID: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  const { playUUID } = await context.params;
  try {
    if (!playUUID) {
      return NextResponse.json(
        { error: 'Valid play ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching play results for playUUID: ${playUUID}`);
    
    // Get organization context from request headers
    const orgContext = await getOrganizationContext(request);
    
    if (!orgContext) {
      return NextResponse.json(
        {
          error: 'Organization context required',
          errorCode: 'NO_ORGANIZATION_CONTEXT',
          details: 'Unable to determine which organization this play belongs to. Please ensure you are accessing this through the correct organization context.',
          suggestions: ['Check if you are logged into the correct organization', 'Try refreshing the page', 'Contact support if this issue persists']
        },
        { status: 400 }
      );
    }
    
    const organizationUUID = orgContext.organizationUUID;
    console.log(`🔍 Using organization: ${organizationUUID} for play results`);
    
    // Connect to the correct organization database
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Get models bound to this specific organization
    const PlayModel = connection.model('Play', Play.schema);
    const SessionResultsModel = connection.model('SessionResults', SessionResults.schema);
    
    // Find the play first to verify it exists in this organization
    const playData = await PlayModel.findOne({ uuid: playUUID, status: { $in: ['active', 'completed'] } });
    
    if (!playData) {
      return NextResponse.json(
        { error: 'Play not found or inactive' },
        { status: 404 }
      );
    }

    console.log(`🔎 Looking for saved results using sessionUUID field for playUUID: ${playUUID}`);
    
    // Try to find saved play results first
    // IMPORTANT: SessionResults model stores play UUIDs in the sessionUUID field
    const savedResults = await SessionResultsModel.findOne({ sessionUUID: playUUID });
    console.log(`📊 Database query result for saved results:`, savedResults ? 'FOUND' : 'NOT_FOUND');
    
    if (savedResults) {
      console.log(`✅ Found saved results details:`, {
        sessionUUID: savedResults.sessionUUID,
        personalRankingLength: savedResults.personalRanking?.length || 0,
        createdAt: savedResults.createdAt,
        updatedAt: savedResults.updatedAt
      });
    }

    if (savedResults) {
      console.log(`Found saved results for play ${playUUID}`);
      return NextResponse.json({
        personalRanking: savedResults.personalRanking,
        statistics: savedResults.sessionStatistics,
        isShared: true,
        createdAt: savedResults.createdAt,
        updatedAt: savedResults.updatedAt
      });
    }

    console.log(`No saved results found for play ${playUUID}, checking live play...`);

    // If no saved results found, try to get from live play and save
    const livePlay = await PlayModel.findOne({ uuid: playUUID });

    if (livePlay) {
      console.log(`Found live play for ${playUUID}:`, {
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
      console.log(`No live play found with UUID: ${playUUID}`);
    }

    if (livePlay && livePlay.status === 'completed') {

      // Try to save the play results now with race condition handling
      try {
        await savePlayResults(livePlay, connection);
        console.log(`✓ Results saved for play ${playUUID}`);
      } catch (saveError: any) {
        // Handle duplicate key error gracefully - it means results were already saved by another request
        if (saveError.code === 11000) {
          console.log(`⚠️ Results already exist for play ${playUUID} (race condition handled)`);
        } else {
          console.error(`Failed to save play results for ${playUUID}:`, saveError);
        }
      }
      
      // Always try to fetch the saved results (they should exist now)
      console.log(`🔄 Re-querying for saved results after save attempt...`);
      const newlySavedResults = await SessionResultsModel.findOne({ sessionUUID: playUUID });
      console.log(`📊 Re-query result:`, newlySavedResults ? 'FOUND' : 'STILL_NOT_FOUND');
      
      if (newlySavedResults) {
        console.log(`✅ Successfully retrieved results for play ${playUUID}`);
        console.log(`📋 Final result summary:`, {
          sessionUUID: newlySavedResults.sessionUUID,
          personalRankingLength: newlySavedResults.personalRanking?.length || 0,
          statisticsIncluded: !!newlySavedResults.sessionStatistics,
          createdAt: newlySavedResults.createdAt,
          updatedAt: newlySavedResults.updatedAt
        });
        return NextResponse.json({
          personalRanking: newlySavedResults.personalRanking,
          statistics: newlySavedResults.sessionStatistics,
          isShared: true,
          createdAt: newlySavedResults.createdAt,
          updatedAt: newlySavedResults.updatedAt
        });
      } else {
        console.error(`❌ Results not found after save attempt for play ${playUUID}`);
        console.error(`🔴 This indicates a serious issue with the save or retrieval process`);
        
        // Debug: Let's check what's actually in the SessionResults collection
        const allResults = await SessionResultsModel.find({}).limit(5);
        console.log(`🔍 Debug: Found ${allResults.length} total results in collection`);
        if (allResults.length > 0) {
          console.log(`🔍 Sample result keys:`, Object.keys(allResults[0].toObject()));
          console.log(`🔍 Sample sessionUUID values:`, allResults.map(r => r.sessionUUID));
        }
      }
    }

    // If no saved results found, return detailed error information
    console.log(`Play ${playUUID} not found in either saved results or live plays`);
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

