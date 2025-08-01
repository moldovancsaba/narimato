import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { Play } from '@/app/lib/models/Play';
import { DeckEntity } from '@/app/lib/models/DeckEntity';
import { CARD_FIELDS, API_FIELDS, PLAY_FIELDS, DECK_FIELDS } from '@/app/lib/constants/fieldNames';
import { generateDeckUuid } from '@/app/lib/utils/deckUuid';
import { savePlayResults } from '@/app/lib/utils/sessionResultsUtils';

const PLAY_EXPIRY_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Parse request body to get deck selection and session info
    const body = await request.json().catch(() => ({}));
    const selectedTag = body.deckTag || 'all';
    const sessionId = body.sessionId; // Browser session ID for analytics

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

    // Create deck entity to validate uniqueness and immutability
    try {
      new DeckEntity(cards);
    } catch (error) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Invalid deck: ' + (error as Error).message }),
        { status: 400 }
      );
    }

    // Generate consistent deck UUID based on selected cards and tag
    const cardUuids = cards.map(card => card[CARD_FIELDS.UUID]);
    const deckUuid = generateDeckUuid(selectedTag, cardUuids);
    
    // Generate unique play UUID for this specific game session
    const playUuid = uuidv4();
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PLAY_EXPIRY_HOURS);

    // Close any existing active plays for this session before creating new
    if (sessionId) {
      const activePlays = await Play.find({ sessionId, status: 'active' });
      for (const activePlay of activePlays) {
        activePlay.status = 'completed';
        activePlay.state = 'completed';
        activePlay.completedAt = new Date();
        const noExpiry = new Date('2099-12-31T23:59:59.999Z');
        activePlay.expiresAt = noExpiry;
        await activePlay.save();
        try {
          await savePlayResults(activePlay);
          console.log(`Hard closed existing active play: ${activePlay.playUuid}`);
        } catch (saveError) {
          console.warn(`Failed to save results for closed play ${activePlay.playUuid}:`, saveError);
        }
      }
    }

    // Create new play session with proper UUID architecture
    const play = new Play({
      [PLAY_FIELDS.UUID]: playUuid,
      [PLAY_FIELDS.SESSION_ID]: sessionId, // Browser session for analytics
      [PLAY_FIELDS.DECK_UUID]: deckUuid,
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

    console.log(`🎮 New play created:`, {
      playUuid: playUuid.substring(0, 8) + '...',
      sessionId: sessionId ? sessionId.substring(0, 8) + '...' : 'none',
      deckUuid: deckUuid.substring(0, 8) + '...',
      deckTag: selectedTag,
      totalCards: cards.length,
      timestamp: new Date().toISOString()
    });
    

    return new NextResponse(
      JSON.stringify({
        [PLAY_FIELDS.UUID]: playUuid,
        browserSessionId: sessionId, // Browser session ID for analytics
        [DECK_FIELDS.UUID]: deckUuid,
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
    console.error('Play creation error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
}
