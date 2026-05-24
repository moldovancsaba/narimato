const mongoose = require('mongoose');
const { TOPIC_STATUS, REGEN_MODES } = require('../intelligence/constants');

const topicSpecSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(TOPIC_STATUS),
      default: TOPIC_STATUS.DRAFT,
      index: true,
    },
    title: { type: String, default: '' },
    conversation: [
      {
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    approvedSummary: { type: String, default: '' },
    planningConstraints: {
      cardCount: { type: Number, default: null },
      hierarchyLevels: { type: Number, default: null },
      limitations: { type: String, default: '' },
    },
    deckRootTag: { type: String, default: null },
    regenMode: {
      type: String,
      enum: [...Object.values(REGEN_MODES), null],
      default: null,
    },
    targetBranchTag: { type: String, default: null },
    regenerateTag: { type: String, default: null },
  },
  { timestamps: true }
);

function registerTopicSpecModel(connection) {
  return (
    connection.models.TopicSpec ||
    connection.model('TopicSpec', topicSpecSchema)
  );
}

module.exports = {
  topicSpecSchema,
  registerTopicSpecModel,
};
