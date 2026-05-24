const mongoose = require('mongoose');
const { JOB_STATUS, JOB_TYPES } = require('../intelligence/constants');

const pipelineJobSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(JOB_TYPES),
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.PENDING,
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    priority: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pipelineJobSchema.index({ status: 1, priority: -1, createdAt: 1 });

function registerPipelineJobModel(connection) {
  return (
    connection.models.PipelineJob ||
    connection.model('PipelineJob', pipelineJobSchema)
  );
}

module.exports = {
  pipelineJobSchema,
  registerPipelineJobModel,
};
