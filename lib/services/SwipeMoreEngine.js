const SwipeMorePlay = require('../models/SwipeMorePlay');
const SwipeOnlyPlay = require('../models/SwipeOnlyPlay');
const SwipeOnlyEngine = require('./SwipeOnlyEngine');
const Card = require('../models/Card');
const { v4: uuidv4 } = require('uuid');

/**
 * SwipeMoreEngine - Manages sequential swipe-only sessions for hierarchical decision making
 * 
 * APPROACH:
 * 1. SwipeMore = multiple consecutive swipe-only sessions
 * 2. Each session swipes through one family of cards fully
 * 3. After completing one session, next session starts on children of liked cards
 * 4. This continues until no more chosen branches remain
 * 
 * DECISION SEQUENCE:
 * - User swipes through root level cards completely
 * - Liked cards become branches to explore
 * - For each liked card with children, start new swipe session
 * - Process in order of user preference (order they were liked)
 * - Continue until all branches explored
 */
class SwipeMoreEngine {
  
  // Static methods for API usage
  static async startSession(organizationId, deckTag) {
    const engine = new SwipeMoreEngine();
    return await engine.createSession(organizationId, deckTag);
  }
  
  static async processSwipe(sessionId, cardId, direction) {
    const engine = new SwipeMoreEngine();
    return await engine.processSwipe(sessionId, cardId, direction);
  }
  
  static async getCurrentCard(sessionId) {
    const engine = new SwipeMoreEngine();
    return await engine.getCurrentCard(sessionId);
  }
  
  static async processVote(sessionId, cardA, cardB, winner) {
    // SwipeMore doesn't use voting - this is a sequential swipe-only mode
    throw new Error('SwipeMore mode does not support voting');
  }
  
  static async getFinalRanking(sessionId) {
    const engine = new SwipeMoreEngine();
    return await engine.getFinalRanking(sessionId);
  }

  /**
   * Create SwipeMore session and start first swipe-only family session
   */
  async createSession(organizationId, deckTag) {
    try {
      console.log(`🚀 Starting SwipeMore session for deck: ${deckTag}`);
      
      // Create master SwipeMore session to track dynamic sequence
      const swipeMoreSession = new SwipeMorePlay({
        uuid: uuidv4(),
        organizationId,
        deckTag,
        // Dynamic sequence management - builds as user progresses
        decisionSequence: [], // Will be populated dynamically as user progresses
        sequencePosition: 0, // Current position in the active sequence
        sequenceComplete: false, // Whether all sequence steps are completed
        // Family queue management - families to be processed in order
        familiesToProcess: [{
          familyTag: deckTag,
          level: 0,
          context: 'root',
          status: 'pending'
        }],
        currentFamilyIndex: 0, // Which family in familiesToProcess we're currently on
        activeSwipeOnlySession: null, // Current swipe-only session ID
        // Combined results
        combinedRanking: [],
        allSwipeHistory: [],
        completed: false,
        status: 'active'
      });

      await swipeMoreSession.save();
      
      // Start first swipe-only session for root family
      const firstSession = await this.startSwipeOnlyFamily(swipeMoreSession, deckTag, 0, 'root');
      
      if (!firstSession || !firstSession.currentCard) {
        throw new Error('Failed to start first family session or no current card available');
      }
      
      console.log(`✅ SwipeMore started with first family session: ${firstSession.currentCard.title}`);
      
      return {
        playId: swipeMoreSession.uuid,
        mode: 'swipe-more',
        state: 'swiping',
        // Current swipe-only session data for UI
        currentCard: firstSession.currentCard,
        currentCardId: firstSession.currentCardId,
        cards: firstSession.cards,
        // SwipeMore-specific tracking
        familyLevel: 0,
        familyContext: 'root',
        totalFamilies: 1, // Will grow as we discover more
        progress: {
          cardsRemaining: firstSession.progress.cardsRemaining,
          cardsCompleted: firstSession.progress.cardsCompleted
        }
      };
    } catch (error) {
      throw new Error(`SwipeMore session creation failed: ${error.message}`);
    }
  }

  /**
   * Start a new swipe-only session for a specific family of cards
   */
  async startSwipeOnlyFamily(swipeMoreSession, familyTag, level, context) {
    try {
      console.log(`🏁 Starting swipe-only family: ${familyTag} (level ${level}, context: ${context})`);
      
      // Create individual swipe-only session
      const swipeOnlySession = await SwipeOnlyEngine.startSession(
        swipeMoreSession.organizationId, 
        familyTag
      );
      
      // Update SwipeMore session to track this sub-session
      swipeMoreSession.activeSwipeOnlySession = swipeOnlySession.playId;
      
      // Update the current family entry in the queue instead of adding a new one
      const currentFamily = swipeMoreSession.familiesToProcess[swipeMoreSession.currentFamilyIndex];
      if (currentFamily) {
        currentFamily.sessionId = swipeOnlySession.playId;
        currentFamily.status = 'active';
      }
      
      await swipeMoreSession.save();
      
      console.log(`✅ Swipe-only family session started: ${swipeOnlySession.playId}`);
      
      // Extract current card from the cards array using currentCardId
      const currentCard = swipeOnlySession.cards?.find(card => card.id === swipeOnlySession.currentCardId);
      
      if (!currentCard) {
        throw new Error('No current card found in swipe-only session');
      }
      
      return {
        swipeOnlySessionId: swipeOnlySession.playId,
        currentCard: currentCard,
        currentCardId: swipeOnlySession.currentCardId,
        cards: swipeOnlySession.cards,
        progress: swipeOnlySession.progress
      };
    } catch (error) {
      throw new Error(`Failed to start swipe-only family: ${error.message}`);
    }
  }

  /**
   * Process a swipe by delegating to current swipe-only session
   */
  async processSwipe(sessionId, cardId, direction) {
    try {
      const swipeMoreSession = await SwipeMorePlay.findOne({
        uuid: sessionId,
        status: 'active'
      });
      
      if (!swipeMoreSession) {
        throw new Error('SwipeMore session not found or not active');
      }
      
      if (!swipeMoreSession.activeSwipeOnlySession) {
        throw new Error('No active swipe-only session found');
      }
      
      console.log(`👆 SwipeMore processing swipe via session: ${swipeMoreSession.activeSwipeOnlySession}`);
      
      // Process swipe in current swipe-only session
      const swipeResult = await SwipeOnlyEngine.processSwipe(
        swipeMoreSession.activeSwipeOnlySession,
        cardId,
        direction
      );
      
      // Record in master session history
      swipeMoreSession.allSwipeHistory.push({
        cardId,
        direction,
        familyContext: this.getCurrentFamilyContext(swipeMoreSession),
        sessionId: swipeMoreSession.activeSwipeOnlySession,
        timestamp: new Date()
      });
      
      if (swipeResult.completed) {
        // Current family session completed
        console.log(`🏁 Family session completed`);
        
        // Get final results from completed swipe-only session
        console.log(`⏳ Getting final results from completed session...`);
        const familyResults = await SwipeOnlyEngine.getFinalRanking(swipeMoreSession.activeSwipeOnlySession);
        console.log(`✅ Final results retrieved`);
        
        // Add to combined ranking
        console.log(`⏳ Adding family to ranking...`);
        this.addFamilyToRanking(swipeMoreSession, familyResults);
        console.log(`✅ Family added to ranking`);
        
        // Mark current family as completed
        console.log(`⏳ Marking current family as completed...`);
        this.markCurrentFamilyCompleted(swipeMoreSession);
        console.log(`✅ Current family marked as completed`);
        
        // Check if we need to start next family
        console.log(`⏳ Starting next family...`);
        const nextFamilyResult = await this.startNextFamily(swipeMoreSession);
        console.log(`✅ Next family result obtained`);
        
        console.log(`⏳ Saving SwipeMore session to database...`);
        await swipeMoreSession.save();
        console.log(`✅ SwipeMore session saved successfully`);
        
        console.log(`🎯 processSwipe returning nextFamilyResult:`, JSON.stringify(nextFamilyResult, null, 2));
        return nextFamilyResult;
      } else {
        // Continue with current family
        await swipeMoreSession.save();
        
        return {
          completed: false,
          nextCardId: swipeResult.nextCardId,
          currentCard: await this.getCurrentCardFromActiveSession(swipeMoreSession),
          familyContext: this.getCurrentFamilyContext(swipeMoreSession)
        };
      }
    } catch (error) {
      throw new Error(`SwipeMore processSwipe failed: ${error.message}`);
    }
  }

  /**
   * Helper method to get current family context
   */
  getCurrentFamilyContext(swipeMoreSession) {
    const currentFamily = swipeMoreSession.familiesToProcess[swipeMoreSession.currentFamilyIndex];
    return {
      familyTag: currentFamily?.familyTag || 'unknown',
      level: currentFamily?.level || 0,
      context: currentFamily?.context || 'unknown'
    };
  }

  /**
   * Get current card from the active swipe-only session
   */
  async getCurrentCardFromActiveSession(swipeMoreSession) {
    try {
      const currentCardData = await SwipeOnlyEngine.getCurrentCard(swipeMoreSession.activeSwipeOnlySession);
      return currentCardData?.currentCard || null;
    } catch (error) {
      console.error('Error getting current card from active session:', error);
      return null;
    }
  }

  /**
   * Add family results to combined ranking
   */
  addFamilyToRanking(swipeMoreSession, familyResults) {
    const currentFamily = this.getCurrentFamilyContext(swipeMoreSession);
    
    // Add all liked cards from family to combined ranking with level context
    familyResults.ranking.forEach((rankedCard, index) => {
      swipeMoreSession.combinedRanking.push({
        ...rankedCard,
        familyLevel: currentFamily.level,
        familyContext: currentFamily.context,
        familyTag: currentFamily.familyTag,
        overallRank: swipeMoreSession.combinedRanking.length + 1,
        familyRank: rankedCard.rank
      });
    });
    
    console.log(`📊 Added ${familyResults.ranking.length} cards from family ${currentFamily.familyTag} to combined ranking`);
  }

  /**
   * Mark current family as completed
   */
  markCurrentFamilyCompleted(swipeMoreSession) {
    const currentFamily = swipeMoreSession.familiesToProcess[swipeMoreSession.currentFamilyIndex];
    if (currentFamily) {
      currentFamily.status = 'completed';
      currentFamily.completedAt = new Date();
    }
  }

  /**
   * Start next family session based on dynamic queue
   * Adds children families to queue based on user likes, then processes next family in queue
   */
  async startNextFamily(swipeMoreSession) {
    try {
      console.log(`🔄 startNextFamily called for session ${swipeMoreSession.uuid}`);
      
      // Get liked cards from last completed family to determine children to add to queue
      console.log(`📊 Getting final ranking from completed session: ${swipeMoreSession.activeSwipeOnlySession}`);
      const lastFamilyResults = await SwipeOnlyEngine.getFinalRanking(swipeMoreSession.activeSwipeOnlySession);
      console.log(`✅ Got ${lastFamilyResults.ranking.length} liked cards from completed family`);
      
      // Add children families to queue based on liked cards (in order they were liked)
      const currentFamily = this.getCurrentFamilyContext(swipeMoreSession);
      console.log(`📊 Current family level: ${currentFamily.level}`);
      
      for (const rankedCard of lastFamilyResults.ranking) {
        console.log(`🔍 Checking liked card ${rankedCard.card.id} (${rankedCard.card.title}) for children...`);
        
        // Find the card in database to check if it has children
        const parentCard = await Card.findOne({
          uuid: rankedCard.card.id,
          organizationId: swipeMoreSession.organizationId,
          isActive: true
        });
        
        if (parentCard && parentCard.isParent && parentCard.hasChildren) {
          console.log(`🌳 Found children for liked card: ${parentCard.name}`);
          
          // Add child family to queue
          const childFamily = {
            familyTag: parentCard.name,
            level: currentFamily.level + 1,
            context: `children-of-${parentCard.name}`,
            parentCard: rankedCard.card,
            status: 'pending'
          };
          
          swipeMoreSession.familiesToProcess.push(childFamily);
          console.log(`➕ Added child family to queue: ${childFamily.context}`);
        } else {
          console.log(`😫 Card ${rankedCard.card.title} has no children`);
        }
      }
      
      // Move to next family in the queue
      swipeMoreSession.currentFamilyIndex++;
      console.log(`➡️ Advanced to family index: ${swipeMoreSession.currentFamilyIndex}`);
      
      // Check if we have more families to process
      if (swipeMoreSession.currentFamilyIndex >= swipeMoreSession.familiesToProcess.length) {
        // No more families in queue - session complete
        console.log(`🎉 All families processed. Completing SwipeMore session.`);
        return await this.completeSwipeMoreSession(swipeMoreSession);
      }
      
      // Get next family from queue
      const nextFamily = swipeMoreSession.familiesToProcess[swipeMoreSession.currentFamilyIndex];
      console.log(`🚀 Starting next family from queue: ${nextFamily.familyTag} (${nextFamily.context})`);
      
      // Start the swipe-only session for this family
      const nextSession = await this.startSwipeOnlyFamily(
        swipeMoreSession,
        nextFamily.familyTag,
        nextFamily.level,
        nextFamily.context
      );
      
      console.log(`✅ Started family session successfully`);
      
      // Add to decision sequence for tracking/debugging
      const sequenceEntry = {
        step: swipeMoreSession.decisionSequence.length + 1,
        type: 'swipe-family',
        familyTag: nextFamily.familyTag,
        level: nextFamily.level,
        context: nextFamily.context,
        timestamp: new Date()
      };
      swipeMoreSession.decisionSequence.push(sequenceEntry);
      
      const responseData = {
        completed: false,
        nextCardId: nextSession.currentCardId,
        currentCard: nextSession.currentCard,
        cards: nextSession.cards,
        // Add hierarchical context for frontend
        hierarchicalLevel: nextFamily.level,
        newLevelCards: nextSession.cards, // Frontend compatibility
        familyContext: {
          familyTag: nextFamily.familyTag,
          level: nextFamily.level,
          context: nextFamily.context
        },
        progress: nextSession.progress
      };
      
      console.log(`🔄 startNextFamily returning response:`, JSON.stringify(responseData, null, 2));
      return responseData;
      
    } catch (error) {
      console.error('Error starting next family:', error);
      return await this.completeSwipeMoreSession(swipeMoreSession);
    }
  }


  /**
   * Complete the entire SwipeMore session
   */
  async completeSwipeMoreSession(swipeMoreSession) {
    swipeMoreSession.completed = true;
    swipeMoreSession.status = 'completed';
    swipeMoreSession.completedAt = new Date();
    swipeMoreSession.activeSwipeOnlySession = null;
    
    await swipeMoreSession.save();
    
    console.log(`🏆 SwipeMore session completed!`);
    console.log(`📊 Total families processed: ${swipeMoreSession.familiesToProcess.length}`);
    console.log(`❤️ Total cards liked: ${swipeMoreSession.combinedRanking.length}`);
    console.log(`📝 Total swipes: ${swipeMoreSession.allSwipeHistory.length}`);
    
    return {
      completed: true,
      finalRanking: swipeMoreSession.combinedRanking,
      totalFamilies: swipeMoreSession.familiesToProcess.length,
      totalLiked: swipeMoreSession.combinedRanking.length,
      totalSwipes: swipeMoreSession.allSwipeHistory.length
    };
  }

  async completeHierarchicalSession(session) {
    session.hierarchicalComplete = true;
    session.completed = true;
    session.status = 'completed';
    session.completedAt = new Date();
    
    // Build final hierarchical ranking from all levels
    session.finalRanking = this.buildHierarchicalRanking(session);
    
    await session.save();
    
    console.log(`🏆 Hierarchical SwipeMore session completed!`);
    console.log(`📊 Total levels: ${session.levelHistory.length + 1}`);
    console.log(`🎯 Final ranking: ${session.finalRanking.length} items`);
    
    return {
      completed: true,
      finalRanking: session.finalRanking,
      hierarchicalComplete: true,
      totalLevels: session.levelHistory.length + 1
    };
  }

  buildHierarchicalRanking(session) {
    const ranking = [];
    let rank = 1;
    
    // Process each level in chronological order
    const allLevels = [...session.levelHistory];
    
    // Add current level if it exists and is complete
    if (session.currentLevel && session.currentLevel.completed) {
      allLevels.push(session.currentLevel);
    }
    
    allLevels.forEach((level, levelIndex) => {
      // Add liked cards from this level
      level.likedCards.forEach(item => {
        ranking.push({
          ...item,
          hierarchicalRank: rank++,
          level: levelIndex + 1,
          parentContext: level.parentTag,
          isHierarchical: true
        });
      });
    });
    
    return ranking;
  }

  async processVote(sessionId, cardA, cardB, winner) {
    try {
      const session = await SwipeMorePlay.findOne({
        uuid: sessionId,
        status: 'active'
      });
      
      if (!session) {
        throw new Error('Session not found or not active');
      }

      console.log(`🗳️ SwipeMore: ${winner} wins vs ${cardA === winner ? cardB : cardA}`);

      // Record vote
      session.votingHistory.push({
        cardA,
        cardB,
        winner,
        timestamp: new Date()
      });

      // Find next comparison needed
      const likedCardIds = session.likedCards.map(item => item.cardId);
      
      for (let i = 0; i < likedCardIds.length; i++) {
        for (let j = i + 1; j < likedCardIds.length; j++) {
          const nextCardA = likedCardIds[i];
          const nextCardB = likedCardIds[j];
          
          const existingComparison = session.votingHistory.find(v => 
            (v.cardA === nextCardA && v.cardB === nextCardB) ||
            (v.cardA === nextCardB && v.cardB === nextCardA)
          );
          
          if (!existingComparison) {
            session.votingContext = {
              newCard: nextCardA,
              compareWith: nextCardB
            };
            
            session.lastActivity = new Date();
            await session.save();
            
            return {
              completed: false,
              requiresMoreVoting: true,
              votingContext: session.votingContext
            };
          }
        }
      }
      
      // All comparisons done, complete session
      console.log('✅ All strategic comparisons complete');
      return await this.completeSession(session);
    } catch (error) {
      throw new Error(`SwipeMore processVote failed: ${error.message}`);
    }
  }

  async completeSession(session) {
    session.completed = true;
    session.status = 'completed';
    session.completedAt = new Date();
    
    // Calculate final ranking
    if (session.likedCards.length === 0) {
      session.finalRanking = [];
    } else if (session.likedCards.length === 1) {
      session.finalRanking = [session.likedCards[0]];
    } else if (!session.votingHistory || session.votingHistory.length === 0) {
      // No voting happened, use swipe order
      session.finalRanking = [...session.likedCards];
    } else {
      // Calculate ranking based on voting results
      session.finalRanking = this.calculateVotingRanking(session);
    }

    await session.save();
    
    return {
      completed: true,
      finalRanking: session.finalRanking
    };
  }

  calculateVotingRanking(session) {
    const cards = session.likedCards.map(item => item.cardId);
    const votes = session.votingHistory;
    
    // Count wins for each card
    const winCounts = {};
    cards.forEach(cardId => winCounts[cardId] = 0);
    
    votes.forEach(vote => {
      if (winCounts.hasOwnProperty(vote.winner)) {
        winCounts[vote.winner]++;
      }
    });
    
    // Sort by win count, then by original swipe order
    const rankedCardIds = cards.sort((a, b) => {
      const winsA = winCounts[a];
      const winsB = winCounts[b];
      
      if (winsA !== winsB) {
        return winsB - winsA; // Higher wins first
      }
      
      // Tie-breaker: use original swipe order (earlier = better)
      const indexA = session.likedCards.findIndex(item => item.cardId === a);
      const indexB = session.likedCards.findIndex(item => item.cardId === b);
      return indexA - indexB;
    });
    
    // Map back to card objects with stats
    return rankedCardIds.map((cardId, index) => {
      const originalItem = session.likedCards.find(item => item.cardId === cardId);
      return {
        ...originalItem,
        rank: index + 1,
        wins: winCounts[cardId],
        totalComparisons: votes.filter(v => v.cardA === cardId || v.cardB === cardId).length
      };
    });
  }

  /**
   * Get current card for UI (delegates to active swipe-only session)
   */
  async getCurrentCard(sessionId) {
    try {
      const swipeMoreSession = await SwipeMorePlay.findOne({ 
        uuid: sessionId,
        status: 'active'
      });
      
      if (!swipeMoreSession) {
        throw new Error('SwipeMore session not found or not active');
      }
      
      if (!swipeMoreSession.activeSwipeOnlySession) {
        throw new Error('No active swipe-only session');
      }
      
      // Get current card from active swipe-only session
      const currentCardData = await SwipeOnlyEngine.getCurrentCard(swipeMoreSession.activeSwipeOnlySession);
      
      if (currentCardData.completed) {
        return {
          completed: true,
          familyContext: this.getCurrentFamilyContext(swipeMoreSession)
        };
      }
      
      return {
        ...currentCardData,
        familyContext: this.getCurrentFamilyContext(swipeMoreSession),
        swipeMoreProgress: {
          currentFamilyIndex: swipeMoreSession.currentFamilyIndex,
          totalFamilies: swipeMoreSession.familiesToProcess.length
        }
      };
      
    } catch (error) {
      throw new Error(`SwipeMore getCurrentCard failed: ${error.message}`);
    }
  }

  /**
   * Get final ranking combining all family sessions
   */
  async getFinalRanking(sessionId) {
    try {
      const swipeMoreSession = await SwipeMorePlay.findOne({ uuid: sessionId });
      
      if (!swipeMoreSession) {
        return null;
      }
      
      return {
        playId: sessionId,
        mode: 'swipe-more',
        completed: swipeMoreSession.completed,
        completedAt: swipeMoreSession.completedAt,
        ranking: swipeMoreSession.combinedRanking || [],
        statistics: {
          totalFamilies: swipeMoreSession.familiesToProcess?.length || 0,
          totalLiked: swipeMoreSession.combinedRanking?.length || 0,
          totalSwipes: swipeMoreSession.allSwipeHistory?.length || 0,
          familyBreakdown: this.buildFamilyBreakdown(swipeMoreSession)
        },
        decisionSequence: swipeMoreSession.decisionSequence || []
      };
    } catch (error) {
      throw new Error(`SwipeMore getFinalRanking failed: ${error.message}`);
    }
  }

  /**
   * Build breakdown of results by family for statistics
   */
  buildFamilyBreakdown(swipeMoreSession) {
    const breakdown = {};
    
    if (!swipeMoreSession.combinedRanking) {
      return breakdown;
    }
    
    swipeMoreSession.combinedRanking.forEach(rankedCard => {
      const familyTag = rankedCard.familyTag || 'unknown';
      
      if (!breakdown[familyTag]) {
        breakdown[familyTag] = {
          familyTag,
          level: rankedCard.familyLevel || 0,
          context: rankedCard.familyContext || 'unknown',
          likedCards: []
        };
      }
      
      breakdown[familyTag].likedCards.push({
        card: rankedCard.card,
        familyRank: rankedCard.familyRank,
        overallRank: rankedCard.overallRank
      });
    });
    
    return Object.values(breakdown);
  }

  /**
   * Generate complete decision sequence with all potential family branches
   * This creates a comprehensive map of all possible swipe sessions based on the card hierarchy
   */
  async generateDecisionSequence(organizationId, rootTag) {
    try {
      console.log(`🧩 Building complete decision sequence for deck: ${rootTag}`);
      
      const decisionSequence = [];
      
      // Build the complete sequence by analyzing the entire hierarchy
      await this.buildSequenceLevel(organizationId, rootTag, 0, 'root', decisionSequence);
      
      console.log(`📋 Complete decision sequence generated: ${decisionSequence.length} total steps`);
      decisionSequence.forEach((step, index) => {
        console.log(`  Step ${index + 1}: ${step.context} - ${step.description}`);
      });
      
      return decisionSequence;
      
    } catch (error) {
      console.error('Error generating decision sequence:', error);
      return [];
    }
  }
  
  /**
   * Recursively build decision sequence levels
   */
  async buildSequenceLevel(organizationId, familyTag, level, context, sequence) {
    try {
      console.log(`🔨 Building sequence level: ${familyTag} (level ${level}, context: ${context})`);
      
      // Find cards for this family/level
      const cards = await Card.find({
        organizationId,
        parentTag: familyTag,
        isActive: true
      }).sort({ name: 1 });
      
      if (cards.length === 0) {
        console.log(`ℹ️  No cards found for family ${familyTag}, skipping`);
        return;
      }
      
      console.log(`📝 Found ${cards.length} cards for family ${familyTag}:`, cards.map(c => c.name));
      
      // Add this family as a step in the sequence
      const stepIndex = sequence.length + 1;
      const step = {
        step: stepIndex,
        type: 'swipe-family',
        familyTag,
        level,
        context,
        description: `Swipe through ${cards.length} cards in ${context}`,
        expectedCards: cards.map(c => ({ id: c.uuid, name: c.name, title: c.title })),
        childFamilies: [] // Will contain all child family steps
      };
      
      sequence.push(step);
      
      // For each card that has children, recursively build child family steps
      const cardsWithChildren = cards.filter(c => c.isParent && c.hasChildren);
      console.log(`🌳 Found ${cardsWithChildren.length} cards with children in family ${familyTag}`);
      
      for (const parentCard of cardsWithChildren) {
        console.log(`🔍 Processing children of ${parentCard.name}...`);
        
        // Record this as a potential child family
        const childFamilyInfo = {
          parentCard: { id: parentCard.uuid, name: parentCard.name, title: parentCard.title },
          familyTag: parentCard.name,
          level: level + 1,
          context: `children-of-${parentCard.name}`
        };
        
        step.childFamilies.push(childFamilyInfo);
        
        // Recursively build the child family sequence
        await this.buildSequenceLevel(
          organizationId, 
          parentCard.name, 
          level + 1, 
          `children-of-${parentCard.name}`, 
          sequence
        );
      }
      
      console.log(`✅ Completed building sequence level for ${familyTag}`);
      
    } catch (error) {
      console.error(`Error building sequence level for ${familyTag}:`, error);
    }
  }

  // ==== DECISION TREE METHODS ====

  async buildDecisionTree(organizationId, parentTag) {
    try {
      console.log(`🏭 DEBUG: Building decision tree for organizationId=${organizationId}, parentTag="${parentTag}"`);
      
      // Fetch root cards
      const rootCards = await Card.find({
        organizationId,
        parentTag,
        isActive: true
      }).sort({ name: 1 });

      console.log(`📊 Found ${rootCards.length} root cards:`, rootCards.map(c => `${c.name} (${c.title})`));

      if (rootCards.length === 0) {
        return null;
      }

      // Shuffle root cards for this session
      const shuffledRootCards = [...rootCards].sort(() => Math.random() - 0.5);
      console.log(`🎲 Shuffled order:`, shuffledRootCards.map(c => c.name));

      // Build tree recursively
      const treeCards = [];
      for (const card of shuffledRootCards) {
        console.log(`🌳 Building tree for card: ${card.name} (isParent: ${card.isParent}, hasChildren: ${card.hasChildren})`);
        const treeCard = await this.buildCardWithChildren(organizationId, card);
        treeCards.push(treeCard);
        console.log(`✅ Tree card built: ${treeCard.name} with ${treeCard.children.length} children`);
      }

      const decisionTree = {
        parentTag,
        cards: treeCards
      };
      
      console.log(`🌳 Decision tree built: ${treeCards.length} root cards, depth varies`);
      console.log(`📋 Tree structure summary:`);
      treeCards.forEach((card, i) => {
        console.log(`  ${i + 1}. ${card.name} (${card.children.length} children)`);
        card.children.forEach((child, j) => {
          console.log(`     ${j + 1}. ${child.name} (${child.children.length} children)`);
        });
      });
      
      return decisionTree;
    } catch (error) {
      throw new Error(`Failed to build decision tree: ${error.message}`);
    }
  }

  async buildCardWithChildren(organizationId, card) {
    const treeCard = {
      id: card.uuid,
      name: card.name,
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl,
      isParent: card.isParent,
      hasChildren: card.hasChildren,
      children: []
    };

    // If this card has children, fetch and build them recursively
    if (card.isParent && card.hasChildren) {
      const childCards = await Card.find({
        organizationId,
        parentTag: card.name,
        isActive: true
      }).sort({ name: 1 });

      // Shuffle children for this session
      const shuffledChildren = [...childCards].sort(() => Math.random() - 0.5);
      
      for (const childCard of shuffledChildren) {
        const childTreeCard = await this.buildCardWithChildren(organizationId, childCard);
        treeCard.children.push(childTreeCard);
      }
    }

    return treeCard;
  }

  getCurrentCard(session) {
    try {
      if (!session.decisionTree || !session.decisionTree.cards) {
        console.error('No decision tree or cards found in session');
        return null;
      }
      
      let currentLevel = session.decisionTree.cards;
      
      // Navigate down the path
      for (let i = 0; i < session.currentPath.length; i++) {
        const cardId = session.currentPath[i];
        const card = currentLevel.find(c => c.id === cardId);
        if (!card || !card.children) {
          console.error(`Path navigation failed at step ${i}, cardId: ${cardId}`);
          return null;
        }
        currentLevel = card.children;
      }
      
      // Return the card at currentCardIndex in the current level
      const targetCard = currentLevel[session.currentCardIndex];
      return targetCard || null;
    } catch (error) {
      console.error('Error getting current card:', error);
      return null;
    }
  }

  moveToNextCard(session) {
    // Move to next sibling
    session.currentCardIndex++;
    
    // Check if we need to backtrack
    while (session.currentPath.length > 0) {
      let currentLevel = session.decisionTree.cards;
      
      // Navigate to current level
      for (let i = 0; i < session.currentPath.length; i++) {
        const cardId = session.currentPath[i];
        const card = currentLevel.find(c => c.id === cardId);
        currentLevel = card.children;
      }
      
      // If there are more cards at this level, we're good
      if (session.currentCardIndex < currentLevel.length) {
        return;
      }
      
      // No more cards at this level, go back up
      session.currentPath.pop();
      session.currentCardIndex = session.currentCardIndex + 1;
      
      // Recalculate currentCardIndex for the parent level
      if (session.currentPath.length > 0) {
        const parentLevel = this.getParentLevel(session);
        const lastPathCardId = session.currentPath[session.currentPath.length - 1];
        const parentCardIndex = parentLevel.findIndex(c => c.id === lastPathCardId);
        session.currentCardIndex = parentCardIndex + 1;
      }
    }
  }

  getParentLevel(session) {
    let currentLevel = session.decisionTree.cards;
    
    // Navigate to parent level (one level up from current path)
    for (let i = 0; i < session.currentPath.length - 1; i++) {
      const cardId = session.currentPath[i];
      const card = currentLevel.find(c => c.id === cardId);
      currentLevel = card.children;
    }
    
    return currentLevel;
  }

  getTreeDepth(decisionTree) {
    if (!decisionTree || !decisionTree.cards) return 0;
    
    let maxDepth = 0;
    
    function calculateDepth(cards, depth) {
      maxDepth = Math.max(maxDepth, depth);
      
      for (const card of cards) {
        if (card.children && card.children.length > 0) {
          calculateDepth(card.children, depth + 1);
        }
      }
    }
    
    calculateDepth(decisionTree.cards, 1);
    return maxDepth;
  }

  countTotalCards(decisionTree) {
    if (!decisionTree || !decisionTree.cards) return 0;
    
    let totalCount = 0;
    
    function countCards(cards) {
      totalCount += cards.length;
      
      for (const card of cards) {
        if (card.children && card.children.length > 0) {
          countCards(card.children);
        }
      }
    }
    
    countCards(decisionTree.cards);
    return totalCount;
  }

  async moveToNextFamily(session) {
    try {
      // Get current level cards to check which ones were liked and have children
      let currentLevel = session.decisionTree.cards;
      
      // Navigate to current family level
      for (let i = 0; i < session.currentPath.length; i++) {
        const cardId = session.currentPath[i];
        const card = currentLevel.find(c => c.id === cardId);
        if (!card || !card.children) {
          console.error(`Path navigation failed at step ${i}, cardId: ${cardId}`);
          return await this.completeTreeSession(session);
        }
        currentLevel = card.children;
      }
      
      // Find liked cards from this family that have children
      const likedCardsWithChildren = [];
      for (const likedCard of session.finalRanking) {
        // Check if this card is from current level and has children
        if (likedCard.level === session.currentPath.length + 1) {
          const cardInTree = currentLevel.find(c => c.id === likedCard.cardId);
          if (cardInTree && cardInTree.children && cardInTree.children.length > 0) {
            likedCardsWithChildren.push(cardInTree);
          }
        }
      }
      
      console.log(`📊 Family complete. Found ${likedCardsWithChildren.length} liked cards with children`);
      
      if (likedCardsWithChildren.length === 0) {
        // No children to explore, need to backtrack or complete
        if (session.currentPath.length === 0) {
          // We're at root level with no more children - session complete
          console.log(`🏁 All families explored. Session complete!`);
          return await this.completeTreeSession(session);
        } else {
          // Backtrack to parent level and continue
          session.currentPath.pop();
          session.currentCardIndex = 0; // Reset to check for more families at parent level
          return await this.moveToNextFamily(session);
        }
      }
      
      // Move to children of first liked card
      const nextFamily = likedCardsWithChildren[0];
      session.currentPath.push(nextFamily.id);
      session.currentCardIndex = 0;
      
      await session.save();
      
      const firstChild = this.getCurrentCard(session);
      if (!firstChild) {
        console.error('Failed to get first child card');
        return await this.completeTreeSession(session);
      }
      
      console.log(`🌳 Moving to children of ${nextFamily.title}. Starting with: ${firstChild.title}`);
      
      return {
        completed: false,
        nextCardId: firstChild.id,
        currentCard: firstChild,
        cards: [firstChild],
        hierarchicalLevel: session.currentPath.length,
        totalSwiped: session.swipeHistory.length,
        totalLiked: session.finalRanking.length
      };
    } catch (error) {
      console.error('Error moving to next family:', error);
      return await this.completeTreeSession(session);
    }
  }

  async completeTreeSession(session) {
    session.completed = true;
    session.status = 'completed';
    session.completedAt = new Date();
    
    await session.save();
    
    console.log(`🏆 SwipeMore hierarchical session completed!`);
    console.log(`📊 Total swiped: ${session.swipeHistory.length}`);
    console.log(`❤️ Total liked: ${session.finalRanking.length}`);
    console.log(`🌳 Tree depth explored: ${this.getTreeDepth(session.decisionTree)}`);
    
    return {
      completed: true,
      finalRanking: session.finalRanking,
      totalSwiped: session.swipeHistory.length,
      totalLiked: session.finalRanking.length,
      treeDepth: this.getTreeDepth(session.decisionTree)
    };
  }
}

module.exports = SwipeMoreEngine;
