import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { Play } from '@/app/lib/models/Play';
import { SESSION_FIELDS, CARD_FIELDS, API_FIELDS, PLAY_FIELDS } from '@/app/lib/constants/fieldNames';

const SESSION_EXPIRY_HOURS = 24;

export async function POST(request: Request) {
  try {
    await dbConnect();

    // Parse request body to get deck selection and session info
    const body = await request.json().catch(() => ({}));
    const selectedTag = body.deckTag || 'all';
    const sessionId = body.sessionId || uuidv4(); // Use provided session or create new one

    // Build match criteria based on deck selection
    let matchCriteria: any = { isActive: true };
    if (selectedTag !== 'all') {
      matchCriteria.tags = selectedTag;
    }

    // Get cards based on selected deck
    const cards = await Card.aggregate([
      { $match: matchCriteria },
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

    // Extract card UUIDs for play creation
    const cardUuids = cards.map(card => card[CARD_FIELDS.UUID]);
    
    // Generate unique play UUID for this specific game session
    const playUuid = uuidv4();
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

    // Create new play session
    const play = new Play({
      [PLAY_FIELDS.UUID]: playUuid,
      [PLAY_FIELDS.SESSION_ID]: sessionId,
      [PLAY_FIELDS.DECK_UUID]: playUuid, // Use playUuid as deck identifier for now
      [PLAY_FIELDS.STATUS]: 'active',
      [PLAY_FIELDS.STATE]: 'swiping',
      deck: cardUuids,
      deckTag: selectedTag,
      totalCards: cards.length,
      [PLAY_FIELDS.EXPIRES_AT]: expiresAt,
      swipes: [],
      votes: [],
      personalRanking: []
    });

    await play.save();

    console.log(`🎮 New play session created:`, {
      playUuid: playUuid.substring(0, 8) + '...',
      sessionId: sessionId.substring(0, 8) + '...',
      deckTag: selectedTag,
      totalCards: cards.length
    });

    return new NextResponse(
      JSON.stringify({
        // Legacy compatibility - return sessionId but actually it's playUuid
        [SESSION_FIELDS.ID]: playUuid, // Frontend expects this field name but gets playUuid
        [PLAY_FIELDS.UUID]: playUuid,
        browserSessionId: sessionId, // Browser session ID using different field name
        deckTag: selectedTag,
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
    console.error('Play session creation error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
}
