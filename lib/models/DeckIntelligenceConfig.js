const mongoose = require('mongoose');

const deckIntelligenceConfigSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    deckRootTag: { type: String, required: true },
    autoApprove: { type: Boolean, default: false },
    playFeedbackEnabled: { type: Boolean, default: true },
    autoApplyPlayInsights: { type: Boolean, default: false },
    minSessionsBeforeTrain: { type: Number, default: 5 },
  },
  { timestamps: true }
);

deckIntelligenceConfigSchema.index(
  { organizationId: 1, deckRootTag: 1 },
  { unique: true }
);

function registerDeckIntelligenceConfigModel(connection) {
  return (
    connection.models.DeckIntelligenceConfig ||
    connection.model('DeckIntelligenceConfig', deckIntelligenceConfigSchema)
  );
}

module.exports = {
  deckIntelligenceConfigSchema,
  registerDeckIntelligenceConfigModel,
};
