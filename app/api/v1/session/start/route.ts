import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { Session } from '@/app/lib/models/Session';
import { DeckEntity } from '@/app/lib/models/DeckEntity';

const SESSION_EXPIRY_HOURS = 24;

export async function POST() {
  try {
    await dbConnect();

    // Get all active cards
    const cards = await Card.aggregate([
      { $match: { isActive: true } },
      // Ensure uniqueness
      { 
        $group: {
          _id: "$uuid",
          card: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$card" } },
      // Random ordering
      { $sample: { size: 999999 } } // Large number to get all cards in random order
    ]);

    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'No cards available' }),
        { status: 404 }
      );
    }

    // Create deck entity to validate uniqueness and immutability
    try {
      new DeckEntity(cards);
    } catch (error) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid deck: ' + (error as Error).message }),
        { status: 400 }
      );
    }

    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    // Create new session
    const session = new Session({
      sessionId,
      deck: cards.map(card => card.uuid),
      expiresAt,
      status: 'active',
      swipes: [],
      votes: [],
      personalRanking: []
    });

    await session.save();

    return new NextResponse(
      JSON.stringify({
        sessionId,
        expiresAt,
        deck: cards.map(card => ({
          uuid: card.uuid,
          type: card.type,
          content: card.content,
          title: card.title,
          tags: card.tags
        }))
      }),
      { 
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    console.error('Session creation error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
