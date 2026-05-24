const mongoose = require('mongoose');
const { SCHEMA_VERSION } = require('../intelligence/constants');

const intelligenceSnapshotSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    deckRootTag: { type: String, default: null, index: true },
    schemaVersion: { type: Number, default: SCHEMA_VERSION },
    webappProjection: { type: mongoose.Schema.Types.Mixed, default: null },
    builtAt: { type: Date, default: null },
    sourceJobId: { type: String, default: null },
  },
  { timestamps: true }
);

intelligenceSnapshotSchema.index({ organizationId: 1, deckRootTag: 1 }, { unique: true });

function registerIntelligenceSnapshotModel(connection) {
  return (
    connection.models.IntelligenceSnapshot ||
    connection.model('IntelligenceSnapshot', intelligenceSnapshotSchema)
  );
}

module.exports = {
  intelligenceSnapshotSchema,
  registerIntelligenceSnapshotModel,
};
