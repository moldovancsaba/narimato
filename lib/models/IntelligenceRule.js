const mongoose = require('mongoose');
const { RULE_SCOPE } = require('../intelligence/constants');

const intelligenceRuleSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    scope: {
      type: String,
      enum: Object.values(RULE_SCOPE),
      default: RULE_SCOPE.DECK,
    },
    deckRootTag: { type: String, default: null },
    topicSpecId: { type: String, default: null },
    priority: { type: Number, default: 0 },
    ruleType: {
      type: String,
      enum: ['must_include', 'must_avoid', 'style', 'factual', 'safety'],
      default: 'style',
    },
    text: { type: String, required: true },
    active: { type: Boolean, default: true },
    provenance: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

intelligenceRuleSchema.index({ organizationId: 1, deckRootTag: 1, active: 1 });

function registerIntelligenceRuleModel(connection) {
  return (
    connection.models.IntelligenceRule ||
    connection.model('IntelligenceRule', intelligenceRuleSchema)
  );
}

module.exports = {
  intelligenceRuleSchema,
  registerIntelligenceRuleModel,
};
