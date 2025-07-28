import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    
    if (!sessionId) {
      return new NextResponse(
        JSON.stringify({ error: 'Session ID is required' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Find session and check if it's still valid
    const session = await Session.findOne({ 
      sessionId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    // Include version in the response for optimistic locking
    const version = session?.version || 0;

    return new NextResponse(
      JSON.stringify({ 
        isValid: !!session,
        state: session?.state || null,
        status: session?.status || null,
        version: version
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Session validation error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
