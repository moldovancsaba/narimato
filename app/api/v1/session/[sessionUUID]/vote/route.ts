import { NextRequest, NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Play } from '@/app/lib/models/Play';
import { Card } from '@/app/lib/models/Card';
import { API_FIELDS, CARD_FIELDS } from '@/app/lib/constants/fieldNames';
import { validateSessionId } from '@/app/lib/utils/fieldValidation';

// FUNCTIONAL: Handle vote submissions during ranking sessions
// STRATEGIC: Core voting logic for binary search ranking algorithm
export const POST = createOrgAwareRoute(async (request, { organizationUUID }, routeContext) => {
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

    // FUNCTIONAL: Parse request body to get vote data
    // STRATEGIC: Extract winner UUID from vote submission
    const body = await request.json().catch(() => ({}));
    const winnerUUID = body.winner;

    if (!winnerUUID) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Winner UUID is required' }),
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

    // FUNCTIONAL: Find the active play session
    // STRATEGIC: Only allow voting on active, non-expired sessions
    const play = await PlayModel.findOne({ 
      uuid: sessionUUID,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    if (!play) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Active session not found or expired' }),
        { status: 404 }
      );
    }

    console.log(`🗳️ Vote received for session ${sessionUUID.substring(0, 8)}...: winner ${winnerUUID.substring(0, 8)}...`);

    // FUNCTIONAL: Record the vote in the play session
    // STRATEGIC: Store vote data for ranking algorithm and audit trail
    const voteTimestamp = new Date();
    
    // FUNCTIONAL: Determine the cards in this comparison
    // STRATEGIC: We need to identify both cards to record the complete vote
    let cardA = null;
    let cardB = null;
    
    // Extract cards from the current pair being voted on
    if (play.currentPair && play.currentPair.cardA && play.currentPair.cardB) {
      cardA = play.currentPair.cardA.uuid;
      cardB = play.currentPair.cardB.uuid;
    } else {
      // Fallback: try to determine from the request
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'No current comparison pair found in session' }),
        { status: 400 }
      );
    }

    // FUNCTIONAL: Validate that we have both cards for the vote
    // STRATEGIC: Ensure vote integrity by requiring complete comparison data
    if (!cardA || !cardB) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Unable to determine comparison cards for vote' }),
        { status: 400 }
      );
    }

    if (winnerUUID !== cardA && winnerUUID !== cardB) {
      return new NextResponse(
        JSON.stringify({ [API_FIELDS.ERROR]: 'Winner must be one of the compared cards' }),
        { status: 400 }
      );
    }

    // FUNCTIONAL: Check for duplicate votes to prevent double submission
    // STRATEGIC: Server-side deduplication to handle rapid client-side clicks
    const isDuplicate = play.votes.some(existingVote => 
      existingVote.cardA === cardA && 
      existingVote.cardB === cardB && 
      existingVote.winner === winnerUUID &&
      (voteTimestamp.getTime() - new Date(existingVote.timestamp).getTime()) < 2000 // Within 2 seconds
    );
    
    if (isDuplicate) {
      console.log(`🚫 Duplicate vote detected for ${cardA.substring(0,8)} vs ${cardB.substring(0,8)}, winner: ${winnerUUID.substring(0,8)} - ignoring but advancing state`);
      
      // For duplicate votes, we need to simulate the binary search advancement
      // Find the new card being ranked (not already in personal ranking)
      const newCardUUID = play.personalRanking.includes(cardA) ? cardB : cardA;
      const comparisonCardUUID = newCardUUID === cardA ? cardB : cardA;
      
      // Calculate search bounds as if we processed this vote
      const previousVotes = play.votes; // Use existing votes
      let searchStart = 0;
      let searchEnd = play.personalRanking.length;
      
      for (const vote of previousVotes) {
        if (vote.cardA !== newCardUUID && vote.cardB !== newCardUUID) {
          continue;
        }
        
        const comparedCardId = vote.cardA === newCardUUID ? vote.cardB : vote.cardA;
        const comparedCardIndex = play.personalRanking.indexOf(comparedCardId);
        
        if (comparedCardIndex === -1) continue;
        
        if (vote.winner === newCardUUID) {
          searchEnd = Math.min(searchEnd, comparedCardIndex);
        } else {
          searchStart = Math.max(searchStart, comparedCardIndex + 1);
        }
      }
      
      // Process the duplicate vote to update bounds
      const comparedCardIndex = play.personalRanking.indexOf(comparisonCardUUID);
      if (comparedCardIndex !== -1) {
        if (winnerUUID === newCardUUID) {
          searchEnd = Math.min(searchEnd, comparedCardIndex);
        } else {
          searchStart = Math.max(searchStart, comparedCardIndex + 1);
        }
      }
      
      // Check if position is determined
      if (searchStart >= searchEnd || (searchEnd - searchStart) <= 1) {
        // Insert the card and return to swiping
        const insertPosition = searchStart;
        
        if (!play.personalRanking.includes(newCardUUID)) {
          const newRanking = [
            ...play.personalRanking.slice(0, insertPosition),
            newCardUUID,
            ...play.personalRanking.slice(insertPosition)
          ];
          play.personalRanking = newRanking;
          console.log(`📍 Duplicate vote: Card ${newCardUUID.substring(0,8)} inserted at position ${insertPosition}`);
        }
        
        // Check for completion
        const swipedCardIds = new Set(play.swipes.map(s => s.uuid));
        const remainingCardsInDeck = play.deck.filter(cardId => !swipedCardIds.has(cardId));
        const rightSwipes = play.swipes.filter(s => s.direction === 'right');
        const unrankedRightSwipes = rightSwipes.filter(swipe => !play.personalRanking.includes(swipe.uuid));
        
        if (remainingCardsInDeck.length === 0 && unrankedRightSwipes.length === 0) {
          play.status = 'completed';
          play.state = 'completed';
          play.completedAt = new Date();
          await play.save();
          
          return new NextResponse(
            JSON.stringify({ completed: true }),
            { status: 200 }
          );
        } else {
          play.state = 'swiping';
          play.currentPair = null;
        }
      } else {
        // Need more comparisons - set up next comparison
        const searchSpace = play.personalRanking.slice(searchStart, searchEnd);
        const middleIndex = Math.floor(searchSpace.length / 2);
        const nextComparisonCardId = searchSpace[middleIndex];
        
        // Get the cards for the next comparison
        const [newCard, comparisonCard] = await Promise.all([
          CardModel.findOne({ uuid: newCardUUID }),
          CardModel.findOne({ uuid: nextComparisonCardId })
        ]);
        
        if (newCard && comparisonCard) {
          // FUNCTIONAL: Randomize which card appears in position A vs B (duplicate vote handling)
          // STRATEGIC: Prevent bias where new card is always Card A
          const shouldSwapPositions = Math.random() < 0.5;
          const firstCard = shouldSwapPositions ? comparisonCard : newCard;
          const secondCard = shouldSwapPositions ? newCard : comparisonCard;
          
          console.log(`🎲 Card positioning (duplicate): ${shouldSwapPositions ? 'swapped' : 'normal'} - A=${firstCard.uuid.substring(0,8)}, B=${secondCard.uuid.substring(0,8)}`);
          
          play.currentPair = {
            cardA: {
              uuid: firstCard.uuid,
              name: firstCard[CARD_FIELDS.TITLE] || 'Untitled',
              body: {
                textContent: firstCard[CARD_FIELDS.CONTENT],
                background: firstCard[CARD_FIELDS.BACKGROUND]
              }
            },
            cardB: {
              uuid: secondCard.uuid,
              name: secondCard[CARD_FIELDS.TITLE] || 'Untitled',
              body: {
                textContent: secondCard[CARD_FIELDS.CONTENT],
                background: secondCard[CARD_FIELDS.BACKGROUND]
              }
            }
          };
          play.state = 'voting';
        } else {
          // Fallback to swiping if cards not found
          play.state = 'swiping';
          play.currentPair = null;
        }
      }
      
      await play.save();
      
      const progress = {
        current: play.votes.length,
        total: Math.ceil(Math.log2(play.personalRanking.length + 1))
      };
      
      return new NextResponse(
        JSON.stringify({ 
          completed: play.state === 'completed',
          session: play.state === 'completed' ? null : {
            sessionUUID: play.uuid,
            deck: play.deckTag,
            status: play.status,
            state: play.state,
            currentPair: play.currentPair,
            progress: progress,
            votes: play.votes,
            personalRanking: play.personalRanking,
            version: play.version
          }
        }),
        { status: 200 }
      );
    }

    // FUNCTIONAL: Add vote to the play session
    // STRATEGIC: Store complete vote information for ranking algorithm
    const newVote = {
      cardA: cardA,
      cardB: cardB,
      winner: winnerUUID,
      timestamp: voteTimestamp
    };

    play.votes.push(newVote);

    // STRATEGIC: Implement proper binary search algorithm for card ranking
    
    // First, determine which card is the new card being inserted (not already in ranking)
    const newCardUUID = play.personalRanking.includes(cardA) ? cardB : cardA;
    const comparisonCardUUID = newCardUUID === cardA ? cardB : cardA;
    
    console.log(`🔍 Binary search vote: newCard=${newCardUUID.substring(0,8)}, comparison=${comparisonCardUUID.substring(0,8)}, winner=${winnerUUID.substring(0,8)}`);
    
    // Calculate accumulated search bounds for the new card based on all its votes
    // Following the binary search specification from documentation section 7.1.1
    function calculateSearchBounds(targetCardId, ranking, votes) {
      let searchStart = 0;
      let searchEnd = ranking.length;
      
      console.log(`🧮 Calculating bounds for ${targetCardId.substring(0,8)} with ranking: [${ranking.map(c => c.substring(0,8)).join(', ')}]`);
      
      for (const vote of votes) {
        if (vote.cardA !== targetCardId && vote.cardB !== targetCardId) {
          continue; // Skip votes not involving target card
        }
        
        const comparedCardId = vote.cardA === targetCardId ? vote.cardB : vote.cardA;
        const comparedCardIndex = ranking.indexOf(comparedCardId);
        
        console.log(`🗳️ Processing vote: ${vote.cardA.substring(0,8)} vs ${vote.cardB.substring(0,8)}, winner: ${vote.winner.substring(0,8)}, compared card: ${comparedCardId.substring(0,8)}, index: ${comparedCardIndex}`);
        
        if (comparedCardIndex === -1) {
          console.log(`⚠️ Skipping vote - comparison card ${comparedCardId.substring(0,8)} not found in ranking`);
          continue; // Skip if comparison card not in ranking
        }
        
        if (vote.winner === targetCardId) {
          // Target card won: it ranks higher than compared card (lower index)
          const prevEnd = searchEnd;
          searchEnd = Math.min(searchEnd, comparedCardIndex);
          console.log(`🏆 ${targetCardId.substring(0,8)} won against ${comparedCardId.substring(0,8)} at index ${comparedCardIndex} - searchEnd: ${prevEnd} → ${searchEnd}`);
        } else {
          // Target card lost: it ranks lower than compared card (higher index)
          const prevStart = searchStart;
          searchStart = Math.max(searchStart, comparedCardIndex + 1);
          console.log(`😞 ${targetCardId.substring(0,8)} lost to ${comparedCardId.substring(0,8)} at index ${comparedCardIndex} - searchStart: ${prevStart} → ${searchStart}`);
        }
      }
      
      console.log(`🎯 Final bounds for ${targetCardId.substring(0,8)}: [${searchStart}, ${searchEnd})`);
      return { start: searchStart, end: searchEnd };
    }
    
    // FUNCTIONAL: Calculate search bounds for the new card based on PREVIOUS votes only
    // STRATEGIC: Exclude the current vote to prevent duplicate processing in binary search
    const previousVotes = play.votes.slice(0, -1); // Exclude the vote just added
    const bounds = calculateSearchBounds(newCardUUID, play.personalRanking, previousVotes);
    
    console.log(`🔍 Using ${previousVotes.length} previous votes for bounds calculation (excluding current vote)`);
    
    // Now manually process the current vote to update the bounds
    const comparedCardIndex = play.personalRanking.indexOf(comparisonCardUUID);
    if (comparedCardIndex !== -1) {
      if (winnerUUID === newCardUUID) {
        // New card won: it ranks higher (lower index)
        bounds.end = Math.min(bounds.end, comparedCardIndex);
        console.log(`🏆 Current vote: ${newCardUUID.substring(0,8)} won vs ${comparisonCardUUID.substring(0,8)} at index ${comparedCardIndex} - bounds.end updated to ${bounds.end}`);
      } else {
        // New card lost: it ranks lower (higher index) 
        bounds.start = Math.max(bounds.start, comparedCardIndex + 1);
        console.log(`😞 Current vote: ${newCardUUID.substring(0,8)} lost vs ${comparisonCardUUID.substring(0,8)} at index ${comparedCardIndex} - bounds.start updated to ${bounds.start}`);
      }
    }
    
    console.log(`🎯 Search bounds for ${newCardUUID.substring(0,8)}: [${bounds.start}, ${bounds.end}) = ${bounds.end - bounds.start} positions`);
    
    let completed = false;
    let nextState = play.state;
    let currentPair = null;
    
    // Check if the card's position is determined
    // - Search space collapsed (start >= end)
    // - Search space is empty (end-start == 0)
    if (bounds.start >= bounds.end) {
      // Position is determined - insert the card
      const insertPosition = bounds.start;
      
      console.log(`🎯 Search space collapsed for ${newCardUUID.substring(0,8)}: bounds=[${bounds.start}, ${bounds.end}), inserting at position ${insertPosition}`);
      
      // Only insert if card is not already in ranking
      if (!play.personalRanking.includes(newCardUUID)) {
        const newRanking = [
          ...play.personalRanking.slice(0, insertPosition),
          newCardUUID,
          ...play.personalRanking.slice(insertPosition)
        ];
        play.personalRanking = newRanking;
        
        console.log(`📍 Card ${newCardUUID.substring(0,8)} inserted at position ${insertPosition}. New ranking: [${play.personalRanking.map(c => c.substring(0,8)).join(', ')}]`);
      } else {
        console.log(`⚠️ Card ${newCardUUID.substring(0,8)} already in ranking, skipping insertion`);
      }
      
      // Check if there are more cards to swipe in the deck
      const swipedCardIds = new Set(play.swipes.map(s => s.uuid));
      const remainingCardsInDeck = play.deck.filter(cardId => !swipedCardIds.has(cardId));
      
      // Check if there are more right-swiped cards to rank
      const rightSwipes = play.swipes.filter(s => s.direction === 'right');
      const unrankedRightSwipes = rightSwipes.filter(swipe => !play.personalRanking.includes(swipe.uuid));
      
      if (remainingCardsInDeck.length === 0 && unrankedRightSwipes.length === 0) {
        // No more cards in deck AND no more cards to rank - session complete
        completed = true;
        nextState = 'completed';
        play.status = 'completed';
        play.completedAt = new Date();
        
        console.log(`✅ Session ${sessionUUID.substring(0, 8)}... completed with ${play.personalRanking.length} ranked cards, ${play.deck.length} total cards processed`);
      } else {
        // Return to swiping - either more cards in deck or more cards to rank
        nextState = 'swiping';
        console.log(`🔄 Returning to swiping state - ${remainingCardsInDeck.length} cards remaining in deck, ${unrankedRightSwipes.length} cards remaining to rank`);
      }
    } else {
      // More comparisons needed for this card - prepare next comparison
      // Follow the random selection strategy: "Pick random card from search space that hasn't been compared yet"
      nextState = 'voting';
      
      const searchSpace = play.personalRanking.slice(bounds.start, bounds.end);
      
      if (searchSpace.length === 0) {
        // Edge case: empty search space means position is determined
        console.log(`⚠️ Empty search space for ${newCardUUID.substring(0,8)}, inserting at bounds.start: ${bounds.start}`);
        
        if (!play.personalRanking.includes(newCardUUID)) {
          const newRanking = [
            ...play.personalRanking.slice(0, bounds.start),
            newCardUUID,
            ...play.personalRanking.slice(bounds.start)
          ];
          play.personalRanking = newRanking;
        }
        
        nextState = 'swiping';
      } else {
        // FUNCTIONAL: Create a helper to check if two cards have already been compared
        // STRATEGIC: Prevent showing duplicate comparisons in the same session
        const havePairBeenVoted = (cardA_check: string, cardB_check: string): boolean => {
          return play.votes.some(vote => 
            (vote.cardA === cardA_check && vote.cardB === cardB_check) ||
            (vote.cardA === cardB_check && vote.cardB === cardA_check)
          );
        };
        
        // FUNCTIONAL: Find available cards in search space that haven't been compared yet
        // STRATEGIC: Use random selection from available candidates
        const availableCandidates = searchSpace.filter(candidateCardId => 
          !havePairBeenVoted(newCardUUID, candidateCardId)
        );
        
        let nextComparisonCardId = null;
        
        if (availableCandidates.length > 0) {
          // Random selection from available candidates
          const randomIndex = Math.floor(Math.random() * availableCandidates.length);
          nextComparisonCardId = availableCandidates[randomIndex];
          console.log(`🎲 Random selection for ${newCardUUID.substring(0,8)}: picked ${nextComparisonCardId.substring(0,8)} from ${availableCandidates.length} available candidates`);
        }
        
        if (!nextComparisonCardId) {
          // No more valid comparisons available - position the card at bounds.start
          console.log(`⚠️ No more valid comparisons for ${newCardUUID.substring(0,8)} - all possible pairs already voted, inserting at bounds.start: ${bounds.start}`);
          
          if (!play.personalRanking.includes(newCardUUID)) {
            const newRanking = [
              ...play.personalRanking.slice(0, bounds.start),
              newCardUUID,
              ...play.personalRanking.slice(bounds.start)
            ];
            play.personalRanking = newRanking;
          }
          
          nextState = 'swiping';
        } else {
          // Fetch cards for next comparison
          const [newCard, comparisonCard] = await Promise.all([
            CardModel.findOne({ uuid: newCardUUID }),
            CardModel.findOne({ uuid: nextComparisonCardId })
          ]);
        
          if (newCard && comparisonCard) {
            // FUNCTIONAL: Randomize which card appears in position A vs B
            // STRATEGIC: Prevent bias where new card is always Card A
            const shouldSwapPositions = Math.random() < 0.5;
            const firstCard = shouldSwapPositions ? comparisonCard : newCard;
            const secondCard = shouldSwapPositions ? newCard : comparisonCard;
            
            console.log(`🎲 Card positioning: ${shouldSwapPositions ? 'swapped' : 'normal'} - A=${firstCard.uuid.substring(0,8)}, B=${secondCard.uuid.substring(0,8)}`);
            
            currentPair = {
              cardA: {
                uuid: firstCard.uuid,
                name: firstCard[CARD_FIELDS.TITLE] || 'Untitled',
                body: {
                  textContent: firstCard[CARD_FIELDS.CONTENT],
                  background: firstCard[CARD_FIELDS.BACKGROUND]
                }
              },
              cardB: {
                uuid: secondCard.uuid,
                name: secondCard[CARD_FIELDS.TITLE] || 'Untitled',
                body: {
                  textContent: secondCard[CARD_FIELDS.CONTENT],
                  background: secondCard[CARD_FIELDS.BACKGROUND]
                }
              }
            };
            
            // Update the session with the new current pair
            play.currentPair = currentPair;
          } else {
            // Fallback: if cards not found, insert at current position
            console.log(`⚠️ Cards not found for comparison, inserting ${newCardUUID.substring(0,8)} at bounds.start: ${bounds.start}`);
            
            if (!play.personalRanking.includes(newCardUUID)) {
              const newRanking = [
                ...play.personalRanking.slice(0, bounds.start),
                newCardUUID,
                ...play.personalRanking.slice(bounds.start)
              ];
              play.personalRanking = newRanking;
            }
            
            nextState = 'swiping';
          }
        }
      }
    }
    
    play.state = nextState;
    await play.save();

    const progress = {
      current: play.votes.length,
      total: Math.ceil(Math.log2(play.personalRanking.length + 1)) // Estimate based on current ranking size
    };

    // FUNCTIONAL: Return updated session state
    // STRATEGIC: Enable frontend to continue or complete the session
    return new NextResponse(
      JSON.stringify({ 
        completed: completed,
        session: completed ? null : {
          sessionUUID: play.uuid,
          deck: play.deckTag,
          status: play.status,
          state: play.state,
          currentPair: currentPair,
          progress: progress,
          votes: play.votes,
          personalRanking: play.personalRanking,
          version: play.version
        }
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    console.error('Vote submission error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
});
