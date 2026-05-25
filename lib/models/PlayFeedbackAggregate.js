const mongoose = require('mongoose');

const playFeedbackAggregateSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    deckRootTag: { type: String, required: true },
    sessionCount: { type: Number, default: 0 },
    windowStartedAt: { type: Date, default: Date.now },
    lastAggregatedAt: { type: Date, default: null },
    topCardUuids: { type: [String], default: [] },
    bottomCardUuids: { type: [String], default: [] },
    pairwiseWins: { type: mongoose.Schema.Types.Mixed, default: {} },
    swipeRates: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0 },
  },
  { timestamps: true }
);

playFeedbackAggregateSchema.index({ organizationId: 1, deckRootTag: 1 }, { unique: true });

function registerPlayFeedbackAggregateModel(connection) {
  return (
    connection.models.PlayFeedbackAggregate ||
    connection.model('PlayFeedbackAggregate', playFeedbackAggregateSchema)
  );
}

module.exports = {
  playFeedbackAggregateSchema,
  registerPlayFeedbackAggregateModel,
};
