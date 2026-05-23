import { connectMaster } from '../../../lib/db.js';
import { withPlayOrganization } from '../../../lib/api/playRoute.js';
import Play from '../../../lib/models/Play.js';
import Card from '../../../lib/models/Card.js';

async function handleGet(playId) {
  const play = await Play.findOne({ uuid: playId }).exec();

  if (!play) {
    return { status: 404, body: { error: 'Play session not found' } };
  }

  console.log(`🔍 Checking hierarchical status for session: ${playId}`);
  console.log(`   Status: ${play.status}, Phase: ${play.hierarchicalPhase}`);

  const response = {
    playId: play.uuid,
    status: play.status,
    hierarchicalPhase: play.hierarchicalPhase,
    isHierarchical: false,
    action: null,
    data: null,
  };

  if (play.status === 'waiting_for_children') {
    const activeChild = play.childSessions?.find((cs) => cs.status === 'active');

    if (activeChild) {
      const childSession = await Play.findOne({ uuid: activeChild.sessionId });

      if (childSession) {
        const childCards = await Card.find({
          uuid: { $in: childSession.cardIds },
          organizationId: play.organizationId,
          isActive: true,
        });

        response.isHierarchical = true;
        response.action = 'start_child_session';
        response.data = {
          childSessionId: childSession.uuid,
          parentName: activeChild.parentName,
          parentPosition: activeChild.parentPosition || 1,
          totalCards: childCards.length,
          cards: childCards.map((card) => ({
            id: card.uuid,
            title: card.title,
            description: card.description,
            imageUrl: card.imageUrl,
          })),
          currentCardId: childSession.cardIds[0],
          message: `Now rank the "${activeChild.parentName}" family`,
        };
      }
    }
  } else if (play.status === 'completed' && !play.hierarchicalPhase) {
    response.isHierarchical = true;
    response.action = 'initialize_hierarchical';
    response.data = {
      message: 'Parent ranking complete. Initializing family sessions...',
    };
  } else if (play.hierarchicalPhase === 'children' && play.status === 'active') {
    response.isHierarchical = true;
    response.action = 'continue_child_session';
    response.data = {
      childSessionId: play.uuid,
      parentName: play.currentParentName,
      parentPosition: play.parentRankPosition,
      message: `Continue ranking the "${play.currentParentName}" family`,
    };
  } else if (play.status === 'hierarchically_completed') {
    response.isHierarchical = true;
    response.action = 'show_hierarchical_results';
    response.data = {
      totalItems: play.hierarchicalRanking?.length || 0,
      hierarchicalRanking: play.hierarchicalRanking,
      details: play.hierarchicalDetails,
      message: 'Hierarchical decision tree complete!',
    };
  } else if (play.status === 'completed' && play.hierarchicalPhase === 'parents') {
    response.action = 'show_standard_results';
    response.data = {
      message: 'Session complete - showing standard results',
    };
  }

  return { status: 200, body: response };
}

async function handlePostInitialize(playId) {
  const DecisionTreeEngine = require('../../../lib/services/DecisionTreeEngine');
  const engine = new DecisionTreeEngine();

  const session = await Play.findOne({ uuid: playId });
  if (!session) {
    throw new Error('Play session not found');
  }
  if (session.status !== 'completed') {
    throw new Error('Session must be completed before hierarchical initialization');
  }

  const result = await engine.processHierarchical(session);

  if (result && result.action) {
    return {
      status: 200,
      body: { success: true, action: result.action, data: result },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      action: 'show_standard_results',
      data: {
        message: 'Session completed - no hierarchical processing needed',
        ranking: session.personalRanking,
      },
    },
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectMaster();

    if (req.method === 'POST') {
      const { playId, action } = req.body || {};
      if (!playId) {
        return res.status(400).json({ error: 'playId required' });
      }
      if (action !== 'initialize') {
        return res.status(400).json({ error: 'Invalid action for POST request' });
      }

      try {
        const result = await withPlayOrganization(playId, () => handlePostInitialize(playId));
        return res.status(result.status).json(result.body);
      } catch (initError) {
        console.error('Failed to initialize hierarchical flow:', initError);
        return res.status(500).json({
          error: 'Failed to initialize hierarchical session',
          details: initError.message,
        });
      }
    }

    const { playId } = req.query;
    if (!playId) {
      return res.status(400).json({ error: 'playId required' });
    }

    const result = await withPlayOrganization(playId, () => handleGet(playId));
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Hierarchical status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
