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
    
    if (!orgContext) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Organization context required' }),
        { status: 400 }
      );
    }
    
    const organizationUUID = orgContext.organizationUUID;

    const connectDb = createOrgDbConnect(organizationUUID);
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
      // Use hashtags field for card hierarchy filtering
      matchCriteria.hashtags = selectedTag;
    }

    console.log(`🔍 Searching for cards with criteria:`, matchCriteria);
    
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

    console.log(`📋 Found ${cards.length} cards for deck: ${selectedTag}`);
    
    if (cards.length === 0) {
      // Also check how many total cards exist to help debugging
      const totalCards = await CardModel.countDocuments({ isActive: true });
      console.log(`❌ No cards found with criteria ${JSON.stringify(matchCriteria)}. Total active cards: ${totalCards}`);
      
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: `No cards available for deck '${selectedTag}'. Found ${totalCards} total active cards in organization.` }),
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
      organizationUUID: organizationUUID, // FUNCTIONAL: Multi-tenant database separation requires organization context
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
