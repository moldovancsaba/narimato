#!/usr/bin/env node
/** Ensure intelligence master + org collections exist. Run after init-master-db.js */
require('./load-env');
const { connectMaster, getOrgConnection, getMasterOrganizationModel, getOrganizationDatabaseName } = require('../lib/db');
const { registerPipelineJobModel } = require('../lib/models/PipelineJob');
const { registerTopicSpecModel } = require('../lib/models/TopicSpec');
const { registerGlobalSettingModel } = require('../lib/models/GlobalSetting');
const { registerDeckIntelligenceConfigModel } = require('../lib/models/DeckIntelligenceConfig');
const { registerSourceModel } = require('../lib/models/Source');
const { registerOrgModels } = require('../lib/models/registry');

async function ensureMasterCollections(conn) {
  const models = [
    registerPipelineJobModel(conn),
    registerTopicSpecModel(conn),
    registerGlobalSettingModel(conn),
    registerDeckIntelligenceConfigModel(conn),
    registerSourceModel(conn),
  ];
  for (const Model of models) {
    await Model.createCollection().catch(() => {});
    await Model.syncIndexes().catch(() => {});
    console.log(`  ✅ ${Model.collection.name}`);
  }
}

async function ensureOrgCollections(org) {
  const dbName = getOrganizationDatabaseName(org);
  const conn = await getOrgConnection(dbName);
  const models = registerOrgModels(conn);
  await models.IntelligenceSnapshot.createCollection().catch(() => {});
  await models.IntelligenceSnapshot.syncIndexes().catch(() => {});
  await models.Card.syncIndexes().catch(() => {});
  console.log(`  ✅ org ${org.slug} (${dbName}) intelligence + card indexes`);
}

async function main() {
  console.log('🔗 Initializing intelligence collections…');
  const master = await connectMaster();
  await ensureMasterCollections(master);

  const Organization = getMasterOrganizationModel();
  const orgs = await Organization.find({ isActive: true });
  for (const org of orgs) {
    await ensureOrgCollections(org);
  }

  console.log('🎉 Intelligence init complete');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
