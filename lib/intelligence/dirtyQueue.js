const {
  connectMaster,
  getMasterGlobalSettingModel,
} = require('../db');
const { GLOBAL_KEYS } = require('./constants');

async function getDirtyState() {
  await connectMaster();
  const GlobalSetting = getMasterGlobalSettingModel();
  const doc = await GlobalSetting.findOne({ key: GLOBAL_KEYS.PROJECTION_DIRTY });
  return doc?.value || { orgIds: [], updatedAt: null };
}

async function markOrgDirty(organizationId, deckRootTag = null) {
  await connectMaster();
  const GlobalSetting = getMasterGlobalSettingModel();
  const existing = await GlobalSetting.findOne({ key: GLOBAL_KEYS.PROJECTION_DIRTY });
  const value = existing?.value || { orgIds: [], decks: {} };
  if (!value.orgIds.includes(organizationId)) {
    value.orgIds.push(organizationId);
  }
  if (deckRootTag) {
    value.decks = value.decks || {};
    const list = value.decks[organizationId] || [];
    if (!list.includes(deckRootTag)) {
      value.decks[organizationId] = [...list, deckRootTag];
    }
  }
  value.updatedAt = new Date().toISOString();
  await GlobalSetting.findOneAndUpdate(
    { key: GLOBAL_KEYS.PROJECTION_DIRTY },
    { key: GLOBAL_KEYS.PROJECTION_DIRTY, value },
    { upsert: true, new: true }
  );
}

async function clearOrgDirty(organizationId) {
  await connectMaster();
  const GlobalSetting = getMasterGlobalSettingModel();
  const existing = await GlobalSetting.findOne({ key: GLOBAL_KEYS.PROJECTION_DIRTY });
  if (!existing?.value) return;
  const value = { ...existing.value };
  value.orgIds = (value.orgIds || []).filter((id) => id !== organizationId);
  if (value.decks) {
    delete value.decks[organizationId];
  }
  value.updatedAt = new Date().toISOString();
  await GlobalSetting.findOneAndUpdate(
    { key: GLOBAL_KEYS.PROJECTION_DIRTY },
    { key: GLOBAL_KEYS.PROJECTION_DIRTY, value },
    { upsert: true, new: true }
  );
}

async function setWorkerHeartbeat(component, payload) {
  await connectMaster();
  const GlobalSetting = getMasterGlobalSettingModel();
  const key = `${GLOBAL_KEYS.WORKER_HEARTBEAT}:${component}`;
  await GlobalSetting.findOneAndUpdate(
    { key },
    { key, value: { ...payload, at: new Date().toISOString() } },
    { upsert: true, new: true }
  );
}

module.exports = {
  getDirtyState,
  markOrgDirty,
  clearOrgDirty,
  setWorkerHeartbeat,
};
