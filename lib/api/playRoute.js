const { connectMaster } = require('../db');
const { withOrganization } = require('../tenantContext');
const { resolvePlayOrganizationId } = require('../playSessionIndex');

async function withPlayOrganization(playId, fn) {
  await connectMaster();
  const organizationId = await resolvePlayOrganizationId(playId);
  if (!organizationId) {
    const err = new Error('Play not found');
    err.statusCode = 404;
    throw err;
  }
  return withOrganization(organizationId, fn);
}

module.exports = {
  withPlayOrganization,
};
