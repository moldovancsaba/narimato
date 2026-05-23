const {
  connectMaster,
  getMasterPlaySessionIndexModel,
} = require('./db');

async function registerPlaySession(playId, organizationId, mode = '') {
  await connectMaster();
  const PlaySessionIndex = getMasterPlaySessionIndexModel();
  await PlaySessionIndex.findOneAndUpdate(
    { playId },
    { playId, organizationId, mode },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function resolvePlayOrganizationId(playId) {
  await connectMaster();
  const PlaySessionIndex = getMasterPlaySessionIndexModel();
  const row = await PlaySessionIndex.findOne({ playId });
  return row ? row.organizationId : null;
}

module.exports = {
  registerPlaySession,
  resolvePlayOrganizationId,
};
