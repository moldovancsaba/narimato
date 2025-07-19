import { NextResponse } from 'next/server';
import { CardService } from '@/lib/services/cardService';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const headersList = headers();
    
    const sessionId = headersList.get('x-session-id') || undefined;
    // Fetch random card for specific project
    const cards = await CardService.getRandomCards(1, sessionId, projectId);

    if (!cards || cards.length === 0) {
      return NextResponse.json(
        { message: 'No cards available' },
        { status: 404 }
      );
    }

    return NextResponse.json(cards[0]);
  } catch (error) {
    console.error('Error fetching random card:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
