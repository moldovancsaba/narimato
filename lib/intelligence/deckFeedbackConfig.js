const { connectMaster, getMasterDeckIntelligenceConfigModel } = require('../db');
const { normalizeHashtag } = require('./projectionNormalizer');

async function getDeckFeedbackConfig(organizationId, deckRootTag) {
  const defaults = {
    playFeedbackEnabled: true,
    autoApplyPlayInsights: false,
    minSessionsBeforeTrain: 5,
    autoApprove: false,
  };
  if (!deckRootTag) return defaults;
  await connectMaster();
  const DeckConfig = getMasterDeckIntelligenceConfigModel();
  const tag = normalizeHashtag(deckRootTag);
  const cfg = await DeckConfig.findOne({ organizationId, deckRootTag: tag });
  if (!cfg) return defaults;
  return {
    playFeedbackEnabled: cfg.playFeedbackEnabled !== false,
    autoApplyPlayInsights: cfg.autoApplyPlayInsights === true,
    minSessionsBeforeTrain: cfg.minSessionsBeforeTrain ?? defaults.minSessionsBeforeTrain,
    autoApprove: cfg.autoApprove === true,
  };
}

module.exports = {
  getDeckFeedbackConfig,
};
