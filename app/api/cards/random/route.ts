import { NextResponse } from 'next/server';
import { CardService } from '@/lib/services/cardService';

export async function GET() {
  try {
    const cards = await CardService.getRandomCards(1);

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
