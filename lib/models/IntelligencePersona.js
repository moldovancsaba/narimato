const mongoose = require('mongoose');

const intelligencePersonaSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    deckRootTag: { type: String, default: '' },
    version: { type: Number, default: 1 },
    tone: { type: String, default: 'professional' },
    audience: { type: String, default: 'survey participants' },
    constraints: { type: [String], default: [] },
    vocabulary: { type: [String], default: [] },
    systemPreamble: { type: String, default: '' },
    updatedByJobId: { type: String, default: null },
    changelog: { type: String, default: '' },
  },
  { timestamps: true }
);

intelligencePersonaSchema.index({ organizationId: 1, deckRootTag: 1 }, { unique: true });

function registerIntelligencePersonaModel(connection) {
  return (
    connection.models.IntelligencePersona ||
    connection.model('IntelligencePersona', intelligencePersonaSchema)
  );
}

module.exports = {
  intelligencePersonaSchema,
  registerIntelligencePersonaModel,
};
