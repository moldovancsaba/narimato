const mongoose = require('mongoose');
const { PLAY_FEEDBACK_SCHEMA_VERSION } = require('../intelligence/constants');

const swipeSnapshotSchema = new mongoose.Schema(
  {
    cardId: String,
    direction: { type: String, enum: ['left', 'right'] },
    timestamp: Date,
  },
  { _id: false }
);

const voteSnapshotSchema = new mongoose.Schema(
  {
    cardA: String,
    cardB: String,
    winner: String,
    timestamp: Date,
  },
  { _id: false }
);

const cardSnapshotSchema = new mongoose.Schema(
  {
    uuid: String,
    name: String,
    title: String,
    globalScore: Number,
    voteCount: Number,
  },
  { _id: false }
);

const playFeedbackEventSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: PLAY_FEEDBACK_SCHEMA_VERSION },
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    playId: { type: String, required: true },
    deckRootTag: { type: String, required: true, index: true },
    mode: { type: String, default: 'classic' },
    completedAt: { type: Date, required: true },
    personalRanking: { type: [String], default: [] },
    swipes: { type: [swipeSnapshotSchema], default: [] },
    votes: { type: [voteSnapshotSchema], default: [] },
    cardSnapshots: { type: [cardSnapshotSchema], default: [] },
    topicSpecId: { type: String, default: null },
    reconciledAt: { type: Date, default: null },
    reconcileJobId: { type: String, default: null },
  },
  { timestamps: true }
);

playFeedbackEventSchema.index({ organizationId: 1, playId: 1 }, { unique: true });
playFeedbackEventSchema.index({ organizationId: 1, deckRootTag: 1, completedAt: -1 });

function registerPlayFeedbackEventModel(connection) {
  return (
    connection.models.PlayFeedbackEvent ||
    connection.model('PlayFeedbackEvent', playFeedbackEventSchema)
  );
}

module.exports = {
  playFeedbackEventSchema,
  registerPlayFeedbackEventModel,
};
