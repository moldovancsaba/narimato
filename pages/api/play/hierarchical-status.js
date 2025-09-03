import { connectDB } from '../../../lib/db.js';
import Play from '../../../lib/models/Play.js';
import Card from '../../../lib/models/Card.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Handle POST request for hierarchical initialization
    if (req.method === 'POST') {
      const { playId, organizationId, action } = req.body;
      
      if (!playId) {
        return res.status(400).json({ error: 'playId required' });
      }
      
      if (action === 'initialize') {
        console.log(`🚀 POST: Initializing hierarchical session for: ${playId}`);
        
        try {
          // Import the clean DecisionTreeEngine
          const DecisionTreeEngine = require('../../../lib/services/DecisionTreeEngine');
          const engine = new DecisionTreeEngine();
          
          // Check if the session needs hierarchical processing
          const session = await Play.findOne({ uuid: playId });
          if (!session) {
            throw new Error('Play session not found');
          }
          
          if (session.status !== 'completed') {
            throw new Error('Session must be completed before hierarchical initialization');
          }
          
          const result = await engine.processHierarchical(session);
          console.log(`✅ Hierarchical initialization result:`, result);
          
          if (result && result.action) {
            // Hierarchical processing started
            return res.json({
              success: true,
              action: result.action,
              data: result
            });
          } else {
            // No hierarchical processing needed - this is a normal completion
            console.log('ℹ️ No hierarchical processing needed for this session');
            return res.json({
              success: true,
              action: 'show_standard_results',
              data: {
                message: 'Session completed - no hierarchical processing needed',
                ranking: session.personalRanking
              }
            });
          }
        } catch (initError) {
          console.error('Failed to initialize hierarchical flow:', initError);
          return res.status(500).json({ 
            error: 'Failed to initialize hierarchical session',
            details: initError.message 
          });
        }
      }
      
      return res.status(400).json({ error: 'Invalid action for POST request' });
    }

    // Handle GET request for status checking
    const { playId, organizationId } = req.query;
    
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }

    // Get the play session with all fields
    const play = await Play.findOne({ uuid: playId }).exec();
    
    if (!play) {
      return res.status(404).json({ error: 'Play session not found' });
    }

    console.log(`🔍 Checking hierarchical status for session: ${playId}`);
    console.log(`   Status: ${play.status}, Phase: ${play.hierarchicalPhase}`);

    // Check what type of hierarchical state we're in
    const response = {
      playId: play.uuid,
      status: play.status,
      hierarchicalPhase: play.hierarchicalPhase,
      isHierarchical: false,
      action: null,
      data: null
    };

    // Case 1: Completed parent session waiting for children
    if (play.status === 'waiting_for_children') {
      console.log(`   Child sessions: ${JSON.stringify(play.childSessions, null, 2)}`);
      const activeChild = play.childSessions?.find(cs => cs.status === 'active');
      console.log(`   Active child found: ${activeChild ? activeChild.sessionId : 'none'}`);
      
      if (activeChild) {
        // Get child session details
        const childSession = await Play.findOne({ uuid: activeChild.sessionId });
        console.log(`   Child session in DB: ${childSession ? 'found' : 'not found'}`);
        
        if (childSession) {
          const childCards = await Card.find({
            uuid: { $in: childSession.cardIds },
            organizationId: play.organizationId,
            isActive: true
          });

          response.isHierarchical = true;
          response.action = 'start_child_session';
          response.data = {
            childSessionId: childSession.uuid,
            parentName: activeChild.parentName,
            parentPosition: activeChild.parentPosition || 1,
            totalCards: childCards.length,
            cards: childCards.map(card => ({
              id: card.uuid,
              title: card.title,
              description: card.description,
              imageUrl: card.imageUrl
            })),
            currentCardId: childSession.cardIds[0],
            message: `Now rank the "${activeChild.parentName}" family`
          };

          console.log(`✅ Active child session found: ${activeChild.sessionId} for "${activeChild.parentName}"`);
        }
      }
    }
    
    // Case 2: Completed parent session that needs hierarchical initialization
    else if (play.status === 'completed' && !play.hierarchicalPhase) {
      response.isHierarchical = true;
      response.action = 'initialize_hierarchical';
      response.data = {
        message: 'Parent ranking complete. Initializing family sessions...'
      };
      
      console.log(`⚠️ Parent session needs hierarchical initialization`);
    }
    
    // Case 3: Child session in progress
    else if (play.hierarchicalPhase === 'children' && play.status === 'active') {
      response.isHierarchical = true;
      response.action = 'continue_child_session';
      response.data = {
        childSessionId: play.uuid,
        parentName: play.currentParentName,
        parentPosition: play.parentRankPosition,
        message: `Continue ranking the "${play.currentParentName}" family`
      };
      
      console.log(`🔄 Child session in progress: "${play.currentParentName}" family`);
    }
    
    // Case 4: Hierarchically completed
    else if (play.status === 'hierarchically_completed') {
      response.isHierarchical = true;
      response.action = 'show_hierarchical_results';
      response.data = {
        totalItems: play.hierarchicalRanking?.length || 0,
        hierarchicalRanking: play.hierarchicalRanking,
        details: play.hierarchicalDetails,
        message: 'Hierarchical decision tree complete!'
      };
      
      console.log(`🏁 Hierarchical session complete with ${play.hierarchicalRanking?.length || 0} items`);
    }
    
    // Case 5: Standard completed session (no hierarchy)
    else if (play.status === 'completed' && play.hierarchicalPhase === 'parents') {
      response.action = 'show_standard_results';
      response.data = {
        message: 'Session complete - showing standard results'
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Hierarchical status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
