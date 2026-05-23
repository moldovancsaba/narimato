const mongoose = require('mongoose');

const SERVER_SELECTION = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
};

let masterConnection = null;
/** @type {Map<string, import('mongoose').Connection>} */
const orgConnections = new Map();

function getBaseUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
    const err = new Error(
      'Missing MONGODB_URI. Set your MongoDB Atlas connection string in .env.local'
    );
    err.statusCode = 500;
    throw err;
  }
  if (!uri.startsWith('mongodb+srv://')) {
    const err = new Error(
      'Invalid MONGODB_URI scheme. Only MongoDB Atlas (mongodb+srv://) is allowed.'
    );
    err.statusCode = 500;
    throw err;
  }
  return uri.trim();
}

function parseOrganizationDbUriOverrides() {
  const raw = process.env.ORGANIZATION_DB_URIS;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.warn('ORGANIZATION_DB_URIS is not valid JSON; ignoring overrides');
    return {};
  }
}

/**
 * Build a MongoDB URI for an organization database.
 * @param {string} baseUri - Master cluster URI (typically MONGODB_URI)
 * @param {string} databaseName - Target database name
 */
function buildOrgMongoUri(baseUri, databaseName) {
  if (!databaseName || typeof databaseName !== 'string') {
    throw new Error('databaseName is required for buildOrgMongoUri');
  }
  const safeName = databaseName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeName) {
    throw new Error('Invalid databaseName for buildOrgMongoUri');
  }

  const overrides = parseOrganizationDbUriOverrides();
  if (overrides[databaseName]) {
    return overrides[databaseName];
  }
  if (overrides[safeName]) {
    return overrides[safeName];
  }

  const qIndex = baseUri.indexOf('?');
  const query = qIndex >= 0 ? baseUri.slice(qIndex) : '';
  const withoutQuery = qIndex >= 0 ? baseUri.slice(0, qIndex) : baseUri;
  const slashIndex = withoutQuery.lastIndexOf('/');
  if (slashIndex === -1) {
    return `${withoutQuery}/${safeName}${query}`;
  }
  const prefix = withoutQuery.slice(0, slashIndex + 1);
  return `${prefix}${safeName}${query}`;
}

async function connectMaster() {
  if (masterConnection && masterConnection.readyState === 1) {
    return masterConnection;
  }
  const uri = getBaseUri();
  masterConnection = await mongoose.createConnection(uri, SERVER_SELECTION).asPromise();
  console.log('✅ MongoDB master connected');
  return masterConnection;
}

/** @deprecated alias — connects master registry DB */
async function connectDB() {
  return connectMaster();
}

async function getOrgConnection(databaseName) {
  const dbName = databaseName;
  const existing = orgConnections.get(dbName);
  if (existing && existing.readyState === 1) {
    return existing;
  }
  const uri = buildOrgMongoUri(getBaseUri(), dbName);
  const conn = await mongoose.createConnection(uri, SERVER_SELECTION).asPromise();
  orgConnections.set(dbName, conn);
  return conn;
}

function getMasterOrganizationModel() {
  if (!masterConnection) {
    throw new Error('Master connection not initialized. Call connectMaster() first.');
  }
  const { registerOrganizationModel } = require('./models/Organization');
  return registerOrganizationModel(masterConnection);
}

function getMasterPlaySessionIndexModel() {
  if (!masterConnection) {
    throw new Error('Master connection not initialized. Call connectMaster() first.');
  }
  const { registerPlaySessionIndexModel } = require('./models/PlaySessionIndex');
  return registerPlaySessionIndexModel(masterConnection);
}

function getMasterUserModel() {
  if (!masterConnection) {
    throw new Error('Master connection not initialized. Call connectMaster() first.');
  }
  const { registerUserModel } = require('./models/User');
  return registerUserModel(masterConnection);
}

function getMasterPagePasswordModel() {
  if (!masterConnection) {
    throw new Error('Master connection not initialized. Call connectMaster() first.');
  }
  const { registerPagePasswordModel } = require('./models/PagePassword');
  return registerPagePasswordModel(masterConnection);
}

async function resolveOrganization(organizationId) {
  await connectMaster();
  const Organization = getMasterOrganizationModel();
  const org = await Organization.findOne({ uuid: organizationId, isActive: true });
  if (!org) {
    const err = new Error('Organization not found');
    err.statusCode = 404;
    throw err;
  }
  return org;
}

function getOrganizationDatabaseName(org) {
  return org.databaseName || org.uuid;
}

module.exports = {
  connectDB,
  connectMaster,
  buildOrgMongoUri,
  getOrgConnection,
  resolveOrganization,
  getOrganizationDatabaseName,
  getMasterOrganizationModel,
  getMasterPlaySessionIndexModel,
  getMasterUserModel,
  getMasterPagePasswordModel,
  parseOrganizationDbUriOverrides,
};
