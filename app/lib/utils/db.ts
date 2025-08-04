import mongoose, { Connection } from 'mongoose';

/**
 * Database Connection Service with Enhanced Security and Monitoring
 * 
 * ARCHITECTURAL PURPOSE:
 * - Manages secure MongoDB connections with proper pooling and caching
 * - Implements connection health monitoring and automatic recovery
 * - Provides centralized database configuration and error handling
 * 
 * SECURITY CONSIDERATIONS:
 * - Connection strings are validated and sanitized
 * - Connection timeouts prevent hanging operations
 * - Pool limits prevent resource exhaustion attacks
 * - Error messages don't leak connection details
 */

// Load organization-specific URIs from environment variables
const ORGANIZATION_DB_URIS: Record<string, string> = {};
try {
  const orgUrisEnv = process.env.ORGANIZATION_DB_URIS;
  if (orgUrisEnv) {
    Object.assign(ORGANIZATION_DB_URIS, JSON.parse(orgUrisEnv));
  }
} catch (error) {
  console.warn('Failed to parse ORGANIZATION_DB_URIS environment variable:', error);
}

// Ensure default environment variable exists (important for initial development & tests)
if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Get MongoDB URI for specific organization
 * Uses buildOrgMongoUri to create organization-specific database names
 */
function getMongoUri(organizationId: string): string {
  let uri: string;
  
  // Check for organization-specific URI first
  if (ORGANIZATION_DB_URIS[organizationId]) {
    uri = ORGANIZATION_DB_URIS[organizationId];
  } else if (organizationId === 'master') {
    // For master database, use the default URI directly
    uri = process.env.MONGODB_URI!;
  } else {
    // Generate organization-specific URI using the base URI
    const baseUri = process.env.MONGODB_URI!;
    uri = buildOrgMongoUri(baseUri, organizationId);
  }

  // Enforce Atlas-only connection - no localhost allowed
  if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
    throw new Error('Localhost MongoDB connections are prohibited. Use only MongoDB Atlas from .env.local');
  }

  // Validate URI format to prevent injection attacks
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
  }

  return uri;
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
declare global {
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

interface MongooseGlobal {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  }
}

const _global = global as MongooseGlobal;
type CachedConnection = {
  conn: Connection | null;
  promise: Promise<Connection> | null;
};

const connectionCache: Record<string, CachedConnection> = {};

// Global connection registry to track active connections
const activeConnections: Record<string, Connection> = {};

function getConnectionCache(organizationId: string): CachedConnection {
  if (!connectionCache[organizationId]) {
    connectionCache[organizationId] = { conn: null, promise: null };
  }
  return connectionCache[organizationId];
}

function clearConnectionCache(organizationId: string): void {
  delete connectionCache[organizationId];
}

async function dbConnect(organizationId: string): Promise<Connection> {
  const cache = getConnectionCache(organizationId);

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const opts = {
      bufferCommands: false,
      // Connection timeout configurations - increased for better reliability
      serverSelectionTimeoutMS: 30000,  // 30 seconds for server selection
      connectTimeoutMS: 30000,          // 30 seconds for initial connection
      socketTimeoutMS: 45000,           // 45 seconds for socket operations
      // Connection pool settings
      maxPoolSize: 10,                  // Limit connection pool size
      minPoolSize: 1,                   // Maintain minimum connections
      maxIdleTimeMS: 60000,             // Close connections after 60s idle
      // Retry and heartbeat settings
      retryWrites: true,
      retryReads: true,
      heartbeatFrequencyMS: 30000,      // Check server every 30 seconds
    };

    const uri = getMongoUri(organizationId);
    
    // Use createConnection instead of connect to avoid global connection conflicts
    cache.promise = mongoose.createConnection(uri, opts).asPromise().then((connection) => {
      // Store in global registry for cleanup
      activeConnections[organizationId] = connection;
      return connection;
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }

  return cache.conn;
}

/**
 * Create organization-specific database connection
 * Each organization gets a separate database with its own collections
 */
export function createOrgDbConnect(organizationId: string) {
  return () => dbConnect(organizationId);
}

/**
 * Connect to master database for organization management
 * This is where the Organization model lives - metadata only
 */
export async function connectMasterDb(): Promise<Connection> {
  return dbConnect('master');
}

/**
 * Utility to build organization-specific database name
 * Uses UUID directly as database name - clean and within MongoDB's 38-byte limit
 */
export function buildOrgDatabaseName(organizationId: string): string {
  if (!organizationId || organizationId.trim() === '') {
    throw new Error('Organization ID cannot be empty');
  }
  
  // For 'default' or other special cases, use a descriptive name
  if (organizationId === 'default') {
    return 'narimato';
  }
  
  // For UUIDs, use them directly - they're unique and within the 38-byte limit
  if (organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
    return organizationId;
  }
  
  // For other organization IDs, sanitize them and use directly
  return organizationId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Build organization-specific MongoDB URI with proper database naming
 */
export function buildOrgMongoUri(baseUri: string, organizationId: string): string {
  const dbName = buildOrgDatabaseName(organizationId);
  
  // Parse the URI to replace database name
  const url = new URL(baseUri);
  
  // For MongoDB Atlas URIs, the database name is typically at the end
  // Format: mongodb+srv://user:pass@cluster.mongodb.net/database?options
  const pathParts = url.pathname.split('/');
  if (pathParts.length > 1) {
    pathParts[1] = dbName; // Replace database name
  } else {
    pathParts.push(dbName); // Add database name
  }
  
  url.pathname = pathParts.join('/');
  return url.toString();
}

/**
 * Health check for organization database connection
 */
export async function checkOrgDbHealth(organizationId: string): Promise<boolean> {
  try {
    const connection = await dbConnect(organizationId);
    return connection.readyState === 1; // 1 = connected
  } catch (error) {
    console.error(`Health check failed for organization ${organizationId}:`, error);
    return false;
  }
}

/**
 * Close organization-specific database connection
 */
export async function closeOrgDbConnection(organizationId: string): Promise<void> {
  const cache = getConnectionCache(organizationId);
  if (cache.conn) {
    await cache.conn.close();
    clearConnectionCache(organizationId);
    delete activeConnections[organizationId];
  }
}

export default dbConnect;
