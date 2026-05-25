const mongoose = require('mongoose');

const SOURCE_KIND = ['text', 'markdown', 'url'];
const SOURCE_STATUS = ['pending', 'ingested', 'failed'];

const sourceSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    kind: { type: String, enum: SOURCE_KIND, default: 'text' },
    content: { type: String, default: '' },
    url: { type: String, default: null },
    status: {
      type: String,
      enum: SOURCE_STATUS,
      default: 'pending',
      index: true,
    },
    topicSpecId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ingestedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

sourceSchema.index({ organizationId: 1, createdAt: -1 });

function registerSourceModel(connection) {
  return connection.models.Source || connection.model('Source', sourceSchema);
}

module.exports = {
  SOURCE_KIND,
  SOURCE_STATUS,
  sourceSchema,
  registerSourceModel,
};
