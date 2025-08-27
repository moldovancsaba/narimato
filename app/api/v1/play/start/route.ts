import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Card, ICard } from '@/app/lib/models/Card';
import { Play } from '@/app/lib/models/Play';
import { getChildren, isPlayable } from '@/app/lib/utils/cardHierarchy';
import { DECK_RULES, UUID_FIELDS, COMMON_FIELDS } from '@/app/lib/constants/fieldNames';
import { savePlayResults } from '@/app/lib/utils/sessionResultsUtils';

const PLAY_EXPIRY_HOURS = 24;

export const POST = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Get models bound to this specific connection
    const CardModel = connection.model('Card', Card.schema);
    const PlayModel = connection.model('Play', Play.schema);

    // Parse request body to get deck selection and session info - STANDARDIZED FIELD NAMES
    const body = await request.json().catch(() => ({}));
    const selectedCardName = body.cardName; // The #HASHTAG name of the card to play
    const sessionUUID = body.sessionUUID || body.sessionId;

    if (!selectedCardName) {
      return new NextResponse(
        JSON.stringify({ error: 'Card name is required' }),
        { status: 400 }
      );
    }

    // Ensure hashtag format
    const cardName = selectedCardName.startsWith('#') ? selectedCardName : `#${selectedCardName}`;

    // Check if the card exists and is playable (has children)
    const parentCard = await CardModel.findOne({ name: cardName, isActive: true });
    if (!parentCard) {
      return new NextResponse(
        JSON.stringify({ error: 'Card not found' }),
        { status: 404 }
      );
    }

    const playableCheck = await isPlayable(organizationUUID, cardName);
    if (!playableCheck) {
      return new NextResponse(
        JSON.stringify({ error: 'Card has no children to play' }),
        { status: 400 }
      );
    }

    // Get all children cards for this parent
    const childCards = await getChildren(organizationUUID, cardName);
    
    // Shuffle the cards randomly
    const cards = childCards.sort(() => Math.random() - 0.5);

    if (cards.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'No cards available' }),
        { status: 404 }
      );
    }

    // Defensive check: Ensure deck meets minimum card threshold for meaningful ranking
    // This prevents play sessions with insufficient cards (e.g., single-card decks)
    if (cards.length < DECK_RULES.MIN_CARDS_FOR_PLAYABLE) {
      return new NextResponse(
        JSON.stringify({ 
          error: `Insufficient cards for meaningful ranking. This deck has ${cards.length} card(s), but at least ${DECK_RULES.MIN_CARDS_FOR_PLAYABLE} cards are required.` 
        }),
        { status: 400 }
      );
    }

    // Generate card UUIDs and deck UUID
    const cardUuids = cards.map(card => card.uuid);
    const deckUuid = uuidv4(); // Simple UUID for this play session
    
    // Generate unique play UUID for this specific game session
    const playUuid = uuidv4();
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PLAY_EXPIRY_HOURS);

    // FUNCTIONAL: Check for existing active plays but don't force close them immediately
    // STRATEGIC: Allow multiple concurrent plays for testing, but warn about potential duplicates
    if (sessionUUID) {
      const activePlays = await PlayModel.find({ sessionUUID, status: 'active' });
      if (activePlays.length > 0) {
        console.log(`⚠️ Found ${activePlays.length} existing active plays for session ${sessionUUID?.substring(0, 8)}...`);
        console.log(`🎮 Creating new play anyway - user may have multiple tabs or restarted session`);
      }
    }

    // Create new play session
    const play = new PlayModel({
      uuid: playUuid,
      sessionUUID,
      deckUUID: deckUuid,
      organizationUUID, // Store organization context for robust retrieval
      status: 'active',
      state: 'swiping',
      deck: cardUuids,
      deckTag: cardName,
      totalCards: cards.length,
      expiresAt,
      swipes: [],
      votes: [],
      personalRanking: []
    });

    await play.save();

    console.log(`🎮 New play created:`, {
      playUuid: playUuid.substring(0, 8) + '...',
      sessionUUID: sessionUUID ? sessionUUID.substring(0, 8) + '...' : 'none',
      deckUuid: deckUuid.substring(0, 8) + '...',
      cardName,
      totalCards: cards.length,
      timestamp: new Date().toISOString()
    });
    
    return new NextResponse(
      JSON.stringify({
        playUuid,
        sessionUUID,
        deckUuid,
        cardName,
        expiresAt,
        deck: cards.map(card => ({
          uuid: card.uuid,
          name: card.name,
          body: card.body,
          hashtags: card.hashtags
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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});
