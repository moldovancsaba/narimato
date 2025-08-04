import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
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

    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Register connection-specific models
    const SessionModel = connection.model('Session', Session.schema);

    // Find session and check if it's still valid
    const session = await SessionModel.findOne({
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
      JSON.stringify({ personalRanking: session.personalRanking || [] }),
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
