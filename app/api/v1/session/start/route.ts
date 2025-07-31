import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { Session } from '@/app/lib/models/Session';
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import { SESSION_FIELDS, CARD_FIELDS, API_FIELDS } from '@/app/lib/constants/fieldNames';

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
          _id: `$${CARD_FIELDS.UUID}`,
          card: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$card" } },
      // Random ordering
      { $sample: { size: 999999 } } // Large number to get all cards in random order
    ]);

    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'No cards available' }),
        { status: 404 }
      );
    }

    // Create deck entity to validate uniqueness and immutability
    try {
      new DeckEntity(cards);
    } catch (error) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Invalid deck: ' + (error as Error).message }),
        { status: 400 }
      );
    }

    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    // Create new session
    const session = new Session({
      [SESSION_FIELDS.ID]: sessionId,
      deck: cards.map(card => card[CARD_FIELDS.UUID]),
      totalCards: cards.length,
      expiresAt,
      status: 'active',
      swipes: [],
      votes: [],
      personalRanking: []
    });

    await session.save();

    return new NextResponse(
      JSON.stringify({
        [SESSION_FIELDS.ID]: sessionId,
        expiresAt,
        deck: cards.map(card => ({
          [CARD_FIELDS.UUID]: card[CARD_FIELDS.UUID],
          [CARD_FIELDS.TYPE]: card[CARD_FIELDS.TYPE],
          [CARD_FIELDS.CONTENT]: card[CARD_FIELDS.CONTENT],
          [CARD_FIELDS.TITLE]: card[CARD_FIELDS.TITLE],
          [CARD_FIELDS.TAGS]: card[CARD_FIELDS.TAGS]
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
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
}
