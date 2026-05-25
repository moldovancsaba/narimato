const mongoose = require('mongoose');
const { MEMORY_KIND, MEMORY_SOURCE } = require('../intelligence/constants');

const intelligenceMemorySchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    deckRootTag: { type: String, default: null, index: true },
    topicSpecId: { type: String, default: null },
    kind: {
      type: String,
      enum: Object.values(MEMORY_KIND),
      default: MEMORY_KIND.DISTILLED,
    },
    content: { type: String, required: true },
    weight: { type: Number, default: 1 },
    playIds: { type: [String], default: [] },
    source: {
      type: String,
      enum: Object.values(MEMORY_SOURCE),
      default: MEMORY_SOURCE.PLAY,
    },
    createdByJobId: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

intelligenceMemorySchema.index({ organizationId: 1, deckRootTag: 1, active: 1 });

function registerIntelligenceMemoryModel(connection) {
  return (
    connection.models.IntelligenceMemory ||
    connection.model('IntelligenceMemory', intelligenceMemorySchema)
  );
}

module.exports = {
  intelligenceMemorySchema,
  registerIntelligenceMemoryModel,
};
