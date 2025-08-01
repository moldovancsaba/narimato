import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { PLAY_FIELDS } from '@/app/lib/constants/fieldNames';

export async function GET(request: NextRequest) {
  try {
    // Note: sessionId parameter is actually playUuid in the new architecture
    const playUuid = request.nextUrl.searchParams.get('sessionId');
    
    if (!playUuid) {
      return new NextResponse(
        JSON.stringify({ error: 'Play ID is required' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Find play and check if it's still valid
    const play = await Play.findOne({ 
      [PLAY_FIELDS.UUID]: playUuid,
      [PLAY_FIELDS.STATUS]: 'active',
      [PLAY_FIELDS.EXPIRES_AT]: { $gt: new Date() }
    });

    if (!play) {
      return new NextResponse(
        JSON.stringify({ error: 'Play not found or inactive' }),
        { status: 404 }
      );
    }

    // Get all cards in deck
    const cards = await Card.find({ 
      uuid: { $in: play.deck },
      isActive: true
    });

    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'No active cards found in deck' }),
        { status: 404 }
      );
    }

    // Preserve original deck order from play
    const orderedCards = play.deck.map((uuid: string) => 
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

    console.log(`🎴 Deck retrieved for ${playUuid.substring(0, 8)}...: ${mappedCards.length} cards`);

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
