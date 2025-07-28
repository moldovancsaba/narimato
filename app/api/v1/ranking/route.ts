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

    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Session not found or inactive' }),
        { status: 404 }
      );
    }

    return new NextResponse(
      JSON.stringify({ ranking: session.personalRanking }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Ranking retrieval error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
