import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';

export async function GET(request: NextRequest) {
  try {
const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const cardId = searchParams.get('cardId');

    if (!sessionId || !cardId) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Find session and validate
    const session = await Session.findOne({ sessionId, status: 'active' });
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Session not found or inactive' }),
        { status: 404 }
      );
    }

    // If no ranked cards yet, this is the first card to be ranked
    if (session.personalRanking.length === 0) {
      // For the first card, return it as both A and B to show in UI
      const card = await Card.findOne({ uuid: cardId });
      if (!card) {
        return new NextResponse(
          JSON.stringify({ error: 'Card not found' }),
          { status: 404 }
        );
      }

      return new NextResponse(
        JSON.stringify({
          cardA: {
            uuid: card.uuid,
            type: card.type,
            content: card.content,
            title: card.title
          },
          cardB: {
            uuid: card.uuid,
            type: card.type,
            content: card.content,
            title: card.title
          },
          isFirstRanking: true
        }),
        { status: 200 }
      );
    }

    // For regular comparisons, use binary search logic with accumulated bounds
    let compareCardId: string;
    
    console.log('Vote comparison API - determining next comparison:', {
      cardId,
      personalRanking: session.personalRanking,
      votesCount: session.votes.length
    });
    
    // Calculate accumulated search bounds for this card across all votes
    function calculateSearchBounds(targetCardId: string, ranking: string[], votes: any[]): { start: number, end: number } {
      let searchStart = 0;
      let searchEnd = ranking.length;
      
      console.log(`\n--- COMPARISON API BOUNDS CALCULATION for ${targetCardId.substring(0, 8)}... ---`);
      console.log('Initial bounds:', { searchStart, searchEnd, rankingLength: ranking.length });
      console.log('Ranking:', ranking.map((card, idx) => `[${idx}] ${card.substring(0, 8)}...`));
      
      // Process all votes for this card to accumulate constraints
      for (const vote of votes) {
        // Check if this vote involves the target card
        if (vote.cardA !== targetCardId && vote.cardB !== targetCardId) {
          continue; // Skip votes not involving target card
        }
        
        // Determine which card is the comparison card (the one already in ranking)
        let comparedCardId: string;
        let comparedCardIndex: number;
        
        if (vote.cardA === targetCardId) {
          // Target card is cardA, so cardB should be the comparison card
          comparedCardId = vote.cardB;
          comparedCardIndex = ranking.indexOf(vote.cardB);
        } else {
          // Target card is cardB, so cardA should be the comparison card
          comparedCardId = vote.cardA;
          comparedCardIndex = ranking.indexOf(vote.cardA);
        }
        
        // Skip if comparison card is not in ranking (shouldn't happen with valid votes)
        if (comparedCardIndex === -1) {
          console.log(`⚠️  Skipping vote: compared card ${comparedCardId.substring(0, 8)}... not in ranking`);
          continue;
        }
        
        const oldBounds = { searchStart, searchEnd };
        
        if (vote.winner === targetCardId) {
          // Target card won: it ranks higher than compared card
          // Narrow upper bound (can't be lower than this position)
          searchEnd = Math.min(searchEnd, comparedCardIndex);
          console.log(`✅ TARGET WON vs [${comparedCardIndex}] ${comparedCardId.substring(0, 8)}... → searchEnd: ${oldBounds.searchEnd} → ${searchEnd}`);
        } else {
          // Target card lost: it ranks lower than compared card  
          // Narrow lower bound (can't be higher than this position)
          searchStart = Math.max(searchStart, comparedCardIndex + 1);
          console.log(`❌ TARGET LOST vs [${comparedCardIndex}] ${comparedCardId.substring(0, 8)}... → searchStart: ${oldBounds.searchStart} → ${searchStart}`);
        }
        
        console.log(`   Current bounds: [${searchStart}, ${searchEnd}) = ${searchEnd - searchStart} cards`);
        if (searchStart < searchEnd) {
          const currentSearchSpace = ranking.slice(searchStart, searchEnd);
          console.log(`   Current search space: ${currentSearchSpace.map((card, idx) => `[${searchStart + idx}] ${card.substring(0, 8)}...`).join(', ')}`);
        } else {
          console.log(`   ⚡ SEARCH SPACE EMPTY - Position determined!`);
        }
      }
      
      console.log(`\nFinal bounds: [${searchStart}, ${searchEnd}) = ${searchEnd - searchStart} cards`);
      console.log('--- END COMPARISON API BOUNDS CALCULATION ---\n');
      
      return { start: searchStart, end: searchEnd };
    }
    
    // Check if there are any previous votes to determine the next comparison
    if (session.votes.length === 0) {
      // First comparison: start with the middle card of the ranking
      const middleIndex = Math.floor(session.personalRanking.length / 2);
      compareCardId = session.personalRanking[middleIndex];
      console.log('First comparison - using middle card:', { middleIndex, compareCardId });
    } else {
      // Calculate accumulated search bounds for this card
      const bounds = calculateSearchBounds(cardId, session.personalRanking, session.votes);
      
      console.log('Accumulated search bounds:', {
        cardId,
        searchStart: bounds.start,
        searchEnd: bounds.end,
        searchSpace: session.personalRanking.slice(bounds.start, bounds.end),
        allVotesForCard: session.votes.filter((v: any) => {
          return v.cardA === cardId || v.cardB === cardId;
        })
      });
      
      // If search space is empty, positioning is complete - insert card and update session state
      if (bounds.start >= bounds.end) {
        console.log('Search space empty - card position determined, inserting card and updating session state');
        
        // Insert card at the determined position
        const insertPosition = bounds.start;
        const newRanking = [
          ...session.personalRanking.slice(0, insertPosition),
          cardId,
          ...session.personalRanking.slice(insertPosition)
        ];
        
        // Update session state to swiping since ranking is complete
        const updatedSession = await Session.findOneAndUpdate(
          { sessionId, status: 'active' },
          {
            $set: {
              personalRanking: newRanking,
              state: 'swiping'
            },
            $inc: { version: 1 }
          },
          { new: true }
        );
        
        if (!updatedSession) {
          return new NextResponse(
            JSON.stringify({ error: 'Failed to update session state' }),
            { status: 500 }
          );
        }
        
        console.log('Card position determined and inserted:', {
          cardId: cardId.substring(0, 8) + '...',
          insertPosition,
          previousRanking: session.personalRanking.map((id: string) => id.substring(0, 8) + '...'),
          newRanking: newRanking.map((id: string) => id.substring(0, 8) + '...'),
          sessionState: 'comparing → swiping'
        });
        
        return new NextResponse(
          JSON.stringify({ 
            positionDetermined: true,
            finalPosition: insertPosition,
            newRanking: newRanking,
            message: 'Card position has been determined and inserted'
          }),
          { status: 200 }
        );
      } else {
        // Select middle card from the valid search space
        const searchSpace = session.personalRanking.slice(bounds.start, bounds.end);
        const middleIndex = Math.floor(searchSpace.length / 2);
        compareCardId = searchSpace[middleIndex];
        console.log('Selected middle from accumulated search space:', { 
          middleIndex, 
          compareCardId,
          searchSpaceSize: searchSpace.length
        });
      }
    }

    // Get both cards and verify they exist
    const [newCard, compareCard] = await Promise.all([
      Card.findOne({ uuid: cardId }),
      Card.findOne({ uuid: compareCardId })
    ]);

    if (!newCard) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Card not found',
          details: { cardId, message: 'The card to be ranked could not be found' }
        }),
        { status: 404 }
      );
    }

    if (!compareCard) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Comparison card not found',
          details: { 
            compareAgainstId: compareCardId,
            message: 'The card to compare against could not be found'
          }
        }),
        { status: 404 }
      );
    }

    return new NextResponse(
      JSON.stringify({
        cardA: {
          uuid: newCard.uuid,
          type: newCard.type,
          content: newCard.content,
          title: newCard.title
        },
        cardB: {
          uuid: compareCard.uuid,
          type: compareCard.type,
          content: compareCard.content,
          title: compareCard.title
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Vote comparison error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
