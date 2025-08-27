import { NextRequest, NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { API_FIELDS, CARD_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';
import { forceCompletionCheckAndUpdate, validatePlayState } from '@/app/lib/utils/playCompletionUtils';

// FUNCTIONAL: Fetch session data for a specific play session by UUID
// STRATEGIC: Enables the swipe interface to load session state and current card pair for voting
export const GET = createOrgAwareRoute(async (request, { organizationUUID }, routeContext) => {
  try {
    // FUNCTIONAL: Extract session UUID from route params
    // STRATEGIC: Handle both direct params and route context structures
    const params = await (routeContext?.params || routeContext);
    const sessionUUID = params?.sessionUUID;
    
    if (!sessionUUID) {
      return new NextResponse(
        JSON.stringify({ error: 'Session UUID is required' }),
        { status: 400 }
      );
    }
    
    // FUNCTIONAL: Validate the session UUID parameter
    // STRATEGIC: Prevent invalid requests from reaching the database
    if (!sessionUUID || !validateSessionId(sessionUUID)) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Valid session UUID is required' }),
        { status: 400 }
      );
    }
    
    // FUNCTIONAL: Connect to organization-specific database
    // STRATEGIC: Multi-tenant architecture requires per-organization database isolation
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();

    // Get models bound to this specific connection
    const PlayModel = connection.model('Play', Play.schema);
    const CardModel = connection.model('Card', Card.schema);

    // Apply no-cache headers to response for real-time data
    const noCacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // FUNCTIONAL: Find play session by UUID (accept active, completed, or voting state)
    // STRATEGIC: Support both active sessions and recently completed ones for seamless UX
    const play = await PlayModel.findOne({ 
      uuid: sessionUUID,
      status: { $in: ['active', 'completed'] },
      expiresAt: { $gt: new Date() }
    });

    if (!play) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Session not found or expired' }),
        { status: 404 }
      );
    }

    console.log(`📋 Session data request for ${sessionUUID.substring(0, 8)}...: ${play.state} state`);

    // FUNCTIONAL: Force-complete plays that should be completed regardless of state
    // STRATEGIC: Handle edge cases where plays get stuck in any state
    if (play && play.status === 'active') {
      const completionUpdated = await forceCompletionCheckAndUpdate(play);
      if (completionUpdated) {
        console.log(`🔄 Play ${play.uuid} was stuck in ${play.state} state and force-completed during fetch`);
      } else if (play.state === 'voting') {
        console.log(`🗳️ Play ${play.uuid} is in voting state - preparing current card pair`);
      }
    }

    // FUNCTIONAL: Validate play state integrity
    // STRATEGIC: Catch and log state inconsistencies for debugging
    const stateValidation = validatePlayState(play);
    if (!stateValidation.isValid) {
      console.warn(`⚠️ Play ${play.uuid} has state inconsistencies:`, stateValidation.issues);
    }

    // FUNCTIONAL: Fetch actual card data for the deck
    // STRATEGIC: Frontend needs complete card information for display
    let deckCards: any[] = [];
    if (play.deck && play.deck.length > 0) {
      try {
        const cards = await CardModel.find({ 
          uuid: { $in: play.deck },
          isActive: true 
        }).lean();
        
        const cardMap = new Map();
        cards.forEach(card => {
          cardMap.set(card.uuid, card);
        });
        
        // Maintain exact deck order to match swipe API logic
        deckCards = play.deck.map((uuid: string) => cardMap.get(uuid)).filter(Boolean);
        
        console.log(`📋 Fetched ${deckCards.length} cards for session ${sessionUUID.substring(0, 8)}`);
      } catch (cardError) {
        console.error('Error fetching deck cards:', cardError);
        // Continue without cards rather than failing completely
      }
    }

    // FUNCTIONAL: Determine current card or card pair based on play state
    // STRATEGIC: Provide appropriate interface data for swiping vs voting states
    let currentPair = null;
    let progress = null;

    if (play.state === 'swiping') {
      // FUNCTIONAL: For swiping state, provide the next card to swipe
      // STRATEGIC: Show individual cards for left/right swipe decisions
      const swipedCardIds = new Set(play.swipes?.map((swipe: any) => swipe.uuid) || []);
      const nextCard = deckCards.find(card => !swipedCardIds.has(card.uuid));
      
      if (nextCard) {
        // Provide a single card as both cardA and cardB for swipe interface compatibility
        currentPair = {
          cardA: {
            uuid: nextCard.uuid,
            name: nextCard.name || 'Untitled',
            body: {
              textContent: nextCard.body?.textContent,
              imageUrl: nextCard.body?.imageUrl,
              background: nextCard.body?.background
            }
          },
          cardB: null // No comparison card in swiping mode
        };
      }
      
      progress = {
        current: play.swipes?.length || 0,
        total: play.deck?.length || 0
      };
      
    } else if (play.state === 'voting' && play.personalRanking.length > 0) {
      // FUNCTIONAL: For voting state, provide the cards that need to be compared
      // STRATEGIC: Use the swipe API's voting context to determine which cards to compare
      
      // Get the most recent right swipe that led to voting mode
      const rightSwipes = play.swipes.filter(s => s.direction === 'right');
      if (rightSwipes.length > 0) {
        const lastRightSwipe = rightSwipes[rightSwipes.length - 1];
        const currentCard = deckCards.find(card => card.uuid === lastRightSwipe.uuid);
        
        if (currentCard) {
          // Use the Play model's method to get the next comparison card
          const compareWithUUID = play.getNextComparisonCard(currentCard.uuid);
          const comparisonCard = deckCards.find(card => card.uuid === compareWithUUID);
          
          if (comparisonCard) {
            currentPair = {
              cardA: {
                uuid: currentCard.uuid,
                name: currentCard.name || 'Untitled',
                body: {
                  textContent: currentCard.body?.textContent,
                  imageUrl: currentCard.body?.imageUrl,
                  background: currentCard.body?.background
                }
              },
              cardB: {
                uuid: comparisonCard.uuid,
                name: comparisonCard.name || 'Untitled',
                body: {
                  textContent: comparisonCard.body?.textContent,
                  imageUrl: comparisonCard.body?.imageUrl,
                  background: comparisonCard.body?.background
                }
              }
            };
            
            console.log(`🗳️ Providing voting pair: ${currentCard.name} vs ${comparisonCard.name}`);
            
            // CRITICAL: Save the current pair to the database for vote route access
            play.currentPair = currentPair;
            await play.save();
          }
        }
      }

      progress = {
        current: play.votes.length,
        total: Math.ceil(Math.log2(play.deck.length)) // Estimated comparisons for binary ranking
      };
    }

    // FUNCTIONAL: Return session data in expected format
    // STRATEGIC: Match the interface expected by the swipe page component
    return new NextResponse(
      JSON.stringify({ 
        session: {
          sessionUUID: play.uuid,
          deck: play.deckTag,
          status: play.status,
          state: play.state,
          currentPair: currentPair,
          progress: progress,
          swipes: play.swipes || [],
          votes: play.votes || [],
          personalRanking: play.personalRanking || [],
          version: play.version || 0
        }
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...noCacheHeaders
        }
      }
    );
  } catch (error) {
    console.error('Session fetch error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
});
