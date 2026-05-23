const { AsyncLocalStorage } = require('async_hooks');
const {
  connectMaster,
  getOrgConnection,
  resolveOrganization,
  getOrganizationDatabaseName,
} = require('./db');
const { registerOrgModels } = require('./models/registry');

const tenantStorage = new AsyncLocalStorage();

/**
 * Run callback with org-scoped Mongoose models bound to the tenant connection.
 * @param {string} organizationId
 * @param {() => Promise<any>} fn
 */
async function withOrganization(organizationId, fn) {
  await connectMaster();
  const org = await resolveOrganization(organizationId);
  const databaseName = getOrganizationDatabaseName(org);
  const conn = await getOrgConnection(databaseName);
  const models = registerOrgModels(conn);
  return tenantStorage.run({ organizationId, databaseName, conn, models }, fn);
}

function getTenantContext() {
  return tenantStorage.getStore() || null;
}

function getTenantModels() {
  return tenantStorage.getStore()?.models || null;
}

module.exports = {
  withOrganization,
  getTenantContext,
  getTenantModels,
  tenantStorage,
};
