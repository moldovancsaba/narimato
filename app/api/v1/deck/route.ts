import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';

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

    // Get all cards in deck
    const cards = await Card.find({ 
      uuid: { $in: session.deck },
      isActive: true
    });

    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'No active cards found in deck' }),
        { status: 404 }
      );
    }

    // Preserve original deck order from session
    const orderedCards = session.deck.map((uuid: string) => 
      cards.find(card => card.uuid === uuid)
    ).filter((card: any) => card !== undefined);

    // Map cards to expected format
    const mappedCards = orderedCards.map((card: any) => ({
      uuid: card.uuid,
      type: card.type,
      content: card.content,
      title: card.title,
      tags: card.tags
    }));

    return new NextResponse(
      JSON.stringify({ deck: mappedCards }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Deck retrieval error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
