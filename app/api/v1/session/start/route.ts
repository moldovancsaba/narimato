import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { Play } from '@/app/lib/models/Play';
import { CARD_FIELDS, API_FIELDS, SESSION_FIELDS } from '@/app/lib/constants/fieldNames';

const SESSION_EXPIRY_HOURS = 24;

export async function POST(request: Request) {
  try {
    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Register connection-specific models
    const CardModel = connection.model('Card', Card.schema);
    const PlayModel = connection.model('Play', Play.schema);

    // Parse request body to get deck selection and session info
    const body = await request.json().catch(() => ({}));
    const selectedTag = body.deckTag || 'all';
    const sessionUUID = body.sessionUUID || body.sessionId || uuidv4(); // Use provided session or create new one

    // Build match criteria based on deck selection
    let matchCriteria: any = { isActive: true };
    if (selectedTag !== 'all') {
      matchCriteria.tags = selectedTag;
    }

    // Get cards based on selected deck
    const cards = await CardModel.aggregate([
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
    const play = new PlayModel({
      uuid: playUuid,
      sessionUUID: sessionUUID,
      deckUUID: playUuid, // Use playUuid as deck identifier for now
      status: 'active',
      state: 'swiping',
      deck: cardUuids,
      deckTag: selectedTag,
      totalCards: cards.length,
      expiresAt: expiresAt,
      swipes: [],
      votes: [],
      personalRanking: []
    });

    await play.save();

    console.log(`🎮 New play session created:`, {
      playUuid: playUuid.substring(0, 8) + '...',
      sessionUUID: sessionUUID.substring(0, 8) + '...',
      deckTag: selectedTag,
      totalCards: cards.length
    });

    return new NextResponse(
      JSON.stringify({
        // Legacy compatibility - return sessionUUID
        [SESSION_FIELDS.UUID]: playUuid, // Use consistent field naming
        sessionId: playUuid, // Keep for backward compatibility
        playUuid: playUuid,
        browserSessionUUID: sessionUUID, // Browser session UUID using consistent naming
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
