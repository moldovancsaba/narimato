import { NextResponse } from 'next/server';
import { CardService } from '@/lib/services/cardService';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const headersList = headers();
    const sessionId = headersList.get('session-id') ?? undefined;
    const cards = await CardService.getRandomCards(1, sessionId);

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
