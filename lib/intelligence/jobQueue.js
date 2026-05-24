const { v4: uuidv4 } = require('uuid');
const {
  connectMaster,
  getMasterPipelineJobModel,
} = require('../db');
const { JOB_STATUS } = require('./constants');

async function enqueueJob({ organizationId, type, payload = {}, priority = 0 }) {
  await connectMaster();
  const PipelineJob = getMasterPipelineJobModel();
  const job = await PipelineJob.create({
    uuid: uuidv4(),
    organizationId,
    type,
    status: JOB_STATUS.PENDING,
    payload,
    priority,
  });
  return job;
}

async function claimNextJob() {
  await connectMaster();
  const PipelineJob = getMasterPipelineJobModel();
  const job = await PipelineJob.findOneAndUpdate(
    { status: JOB_STATUS.PENDING },
    {
      status: JOB_STATUS.RUNNING,
      startedAt: new Date(),
    },
    { sort: { priority: -1, createdAt: 1 }, new: true }
  );
  return job;
}

async function completeJob(jobUuid, result = null) {
  await connectMaster();
  const PipelineJob = getMasterPipelineJobModel();
  return PipelineJob.findOneAndUpdate(
    { uuid: jobUuid },
    {
      status: JOB_STATUS.COMPLETED,
      result,
      completedAt: new Date(),
      error: null,
    },
    { new: true }
  );
}

async function failJob(jobUuid, errorMessage) {
  await connectMaster();
  const PipelineJob = getMasterPipelineJobModel();
  return PipelineJob.findOneAndUpdate(
    { uuid: jobUuid },
    {
      status: JOB_STATUS.FAILED,
      error: String(errorMessage),
      completedAt: new Date(),
    },
    { new: true }
  );
}

async function listRecentJobs(organizationId, limit = 20) {
  await connectMaster();
  const PipelineJob = getMasterPipelineJobModel();
  const query = organizationId ? { organizationId } : {};
  return PipelineJob.find(query).sort({ createdAt: -1 }).limit(limit);
}

module.exports = {
  enqueueJob,
  claimNextJob,
  completeJob,
  failJob,
  listRecentJobs,
};
