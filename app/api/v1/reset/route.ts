import { NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { Session } from '@/app/lib/models/Session';
import { PersonalRanking } from '@/app/lib/models/PersonalRanking';

export async function POST(request: Request) {
  try {
    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Register connection-specific models
    const CardModel = connection.model('Card', Card.schema);
    const SessionModel = connection.model('Session', Session.schema);
    const PersonalRankingModel = connection.model('PersonalRanking', PersonalRanking.schema);
    
    // Delete all documents from all collections
    await Promise.all([
      CardModel.deleteMany({}),
      SessionModel.deleteMany({}),
      PersonalRankingModel.deleteMany({})
    ]);

    return NextResponse.json({ message: 'Database reset successful' });
  } catch (error) {
    console.error('Failed to reset database:', error);
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}
