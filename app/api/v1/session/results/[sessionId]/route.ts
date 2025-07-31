import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { SessionResults } from '@/app/lib/models/SessionResults';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';

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

    // Try to find saved session results first
    const savedResults = await SessionResults.findOne({ sessionId });
    
    if (savedResults) {
      return NextResponse.json({
        personalRanking: savedResults.personalRanking,
        statistics: savedResults.sessionStatistics,
        isShared: true,
        createdAt: savedResults.createdAt,
        updatedAt: savedResults.updatedAt
      });
    }

    // If no saved results found, return error
    return NextResponse.json(
      { error: 'Session results not found or not shareable' },
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
