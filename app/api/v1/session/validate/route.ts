import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { SESSION_FIELDS, API_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get(SESSION_FIELDS.ID);
    
    if (!sessionId || !validateSessionId(sessionId)) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Valid session ID is required' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Find session and check if it's still valid
    const session = await Session.findOne({ 
      [SESSION_FIELDS.ID]: sessionId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    // Include version in the response for optimistic locking
    const version = session?.[SESSION_FIELDS.VERSION] || 0;

    return new NextResponse(
      JSON.stringify({ 
        isValid: !!session,
        state: session?.state || null,
        status: session?.status || null,
        [SESSION_FIELDS.VERSION]: version,
        session: session ? {
          swipes: session.swipes || [],
          personalRanking: session.personalRanking || []
        } : null
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Session validation error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
}
