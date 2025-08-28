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

/**
 * Enhanced MongoDB connection with comprehensive timeout handling and monitoring
 * FUNCTIONAL: Implements exponential backoff retry strategy with detailed error categorization
 * STRATEGIC: Ensures robust connection establishment with advanced monitoring and recovery
 */
async function createConnectionWithRetry(uri: string, opts: any, organizationId: string, maxRetries = 3): Promise<Connection> {
  let lastError: Error | null = null;
  let connectionStartTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const attemptStartTime = Date.now();
      console.log(`🔗 [${organizationId}] Connection attempt ${attempt}/${maxRetries} started at ${new Date().toISOString()}`);
      
      // Enhanced timeout wrapper with multiple timeout scenarios
      const connection = await Promise.race([
        // Main connection promise
        mongoose.createConnection(uri, opts).asPromise(),
        
        // Connection timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => {
            const elapsed = Date.now() - attemptStartTime;
            reject(new Error(`CONNECTION_TIMEOUT: Failed to establish connection after ${elapsed}ms (configured: ${opts.connectTimeoutMS}ms)`));
          }, opts.connectTimeoutMS + 2000) // Add 2s buffer
        ),
        
        // Server selection timeout
        new Promise<never>((_, reject) => 
          setTimeout(() => {
            const elapsed = Date.now() - attemptStartTime;
            reject(new Error(`SERVER_SELECTION_TIMEOUT: Failed to select server after ${elapsed}ms (configured: ${opts.serverSelectionTimeoutMS}ms)`));
          }, opts.serverSelectionTimeoutMS + 1000) // Add 1s buffer
        )
      ]);
      
      const connectionTime = Date.now() - attemptStartTime;
      console.log(`⚡ [${organizationId}] Connection established in ${connectionTime}ms`);
      
      // Enhanced connection event monitoring
      setupConnectionMonitoring(connection, organizationId);
      
      // Connection health validation
      await validateConnectionHealth(connection, organizationId);
      
      // Store in global registry for cleanup and monitoring
      activeConnections[organizationId] = connection;
      
      const totalTime = Date.now() - connectionStartTime;
      console.log(`✅ [${organizationId}] MongoDB connection successful (total time: ${totalTime}ms, attempt: ${attempt})`);
      
      return connection;
      
    } catch (error) {
      lastError = error as Error;
      const attemptTime = Date.now() - connectionStartTime;
      
      // Enhanced error categorization and logging
      const errorCategory = categorizeConnectionError(error);
      console.error(`❌ [${organizationId}] Attempt ${attempt} failed (${attemptTime}ms):`, {
        category: errorCategory,
        message: lastError.message,
        name: lastError.name,
        timeout: attemptTime
      });
      
      // Store error metrics for monitoring
      recordConnectionError(organizationId, errorCategory, attemptTime, attempt);
      
      if (attempt === maxRetries) {
        console.error(`💥 [${organizationId}] All ${maxRetries} connection attempts exhausted`);
        break;
      }
      
      // Adaptive backoff based on error type
      const delay = calculateBackoffDelay(attempt, errorCategory);
      console.log(`⏳ [${organizationId}] Retrying in ${delay}ms... (${errorCategory})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All attempts failed - create comprehensive error report
  const totalTime = Date.now() - connectionStartTime;
  const errorReport = {
    organizationId,
    attempts: maxRetries,
    totalTime,
    lastError: lastError?.message,
    category: categorizeConnectionError(lastError!)
  };
  
  console.error(`💥 [${organizationId}] Connection completely failed:`, errorReport);
  throw new Error(`MONGOOSE_CONNECTION_FAILURE: Failed to connect to MongoDB for ${organizationId} after ${maxRetries} attempts in ${totalTime}ms. Last error: ${lastError?.message}`);
}

async function dbConnect(organizationId: string): Promise<Connection> {
  const cache = getConnectionCache(organizationId);

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const opts = {
      // FUNCTIONAL: Enhanced connection management to prevent timeout errors
      // STRATEGIC: Optimized for MongoDB Atlas with proper retry and recovery mechanisms
      bufferCommands: false,             // Disable buffering to fail fast on connection issues
      
      // Connection timeout configurations - optimized for Atlas with longer timeouts for cold starts
      serverSelectionTimeoutMS: 30000,  // 30 seconds for server selection (increased for cold start)
      connectTimeoutMS: 30000,          // 30 seconds for initial connection (increased for cold start)
      socketTimeoutMS: 60000,           // 60 seconds for socket operations (increased for slow ops)
      
      // Connection pool settings - enhanced for stability
      maxPoolSize: 5,                   // Reduced pool size for better management
      minPoolSize: 0,                   // No minimum connections (create on demand)
      maxIdleTimeMS: 30000,             // Close idle connections after 30s (reduced from 60s)
      waitQueueTimeoutMS: 10000,        // 10 seconds max wait for connection from pool
      
      // Retry and heartbeat settings - more aggressive
      retryWrites: true,
      retryReads: true,
      heartbeatFrequencyMS: 10000,      // Check server every 10 seconds (more frequent)
      
      // Additional resilience settings
      maxStalenessSeconds: 90,          // Allow slightly stale reads for better availability
      compressors: ['zlib'],            // Enable compression to reduce network load
      zlibCompressionLevel: 6,          // Moderate compression level
      
      // Connection state monitoring
      monitorCommands: true,            // Enable command monitoring for debugging
    };

    const uri = getMongoUri(organizationId);
    
    // Use createConnection with retry logic and enhanced error handling
    cache.promise = createConnectionWithRetry(uri, opts, organizationId);
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
 * Enhanced connection monitoring and error categorization
 */
function setupConnectionMonitoring(connection: Connection, organizationId: string): void {
  // Enhanced error tracking with timestamps and context
  connection.on('error', (err) => {
    const timestamp = new Date().toISOString();
    console.error(`🚨 [${organizationId}] MongoDB error at ${timestamp}:`, {
      message: err.message,
      name: err.name,
      code: (err as any).code
    });
  });
  
  connection.on('disconnected', () => {
    const timestamp = new Date().toISOString();
    console.warn(`⚠️ [${organizationId}] MongoDB disconnected at ${timestamp}`);
    clearConnectionCache(organizationId);
    delete activeConnections[organizationId];
  });
  
  connection.on('reconnected', () => {
    const timestamp = new Date().toISOString();
    console.log(`🔄 [${organizationId}] MongoDB reconnected at ${timestamp}`);
    activeConnections[organizationId] = connection;
  });
  
  connection.on('close', () => {
    const timestamp = new Date().toISOString();
    console.log(`🔐 [${organizationId}] MongoDB connection closed at ${timestamp}`);
    clearConnectionCache(organizationId);
    delete activeConnections[organizationId];
  });
  
  // Monitor connection pool events
  connection.on('connectionPoolCreated', () => {
    console.log(`🏊 [${organizationId}] Connection pool created`);
  });
  
  connection.on('connectionPoolClosed', () => {
    console.log(`🚫 [${organizationId}] Connection pool closed`);
  });
}

/**
 * Validate connection health immediately after establishment
 */
async function validateConnectionHealth(connection: Connection, organizationId: string): Promise<void> {
  try {
    const startTime = Date.now();
    
    // Simple ping to validate connection
    await connection.db.admin().ping();
    
    const pingTime = Date.now() - startTime;
    console.log(`🏓 [${organizationId}] Connection health validated (ping: ${pingTime}ms)`);
    
    // Check connection state
    if (connection.readyState !== 1) {
      throw new Error(`Invalid connection state: ${connection.readyState}`);
    }
    
  } catch (error) {
    console.error(`❌ [${organizationId}] Connection health validation failed:`, error);
    throw new Error(`CONNECTION_HEALTH_FAILED: ${error}`);
  }
}

/**
 * Categorize connection errors for better handling
 */
function categorizeConnectionError(error: Error): string {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  if (message.includes('timeout') || name.includes('timeout')) {
    if (message.includes('server selection')) return 'SERVER_SELECTION_TIMEOUT';
    if (message.includes('socket')) return 'SOCKET_TIMEOUT';
    if (message.includes('connection')) return 'CONNECTION_TIMEOUT';
    return 'GENERAL_TIMEOUT';
  }
  
  if (message.includes('authentication') || message.includes('auth')) {
    return 'AUTHENTICATION_ERROR';
  }
  
  if (message.includes('network') || message.includes('enotfound') || message.includes('econnrefused')) {
    return 'NETWORK_ERROR';
  }
  
  if (message.includes('pool') || message.includes('connection limit')) {
    return 'CONNECTION_POOL_ERROR';
  }
  
  if (name.includes('mongo')) {
    return 'MONGODB_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * Calculate adaptive backoff delay based on error type and attempt
 */
function calculateBackoffDelay(attempt: number, errorCategory: string): number {
  const baseDelay = 1000; // 1 second base
  
  // Different backoff strategies for different error types
  switch (errorCategory) {
    case 'SERVER_SELECTION_TIMEOUT':
    case 'NETWORK_ERROR':
      // Longer backoff for network issues
      return Math.min(baseDelay * Math.pow(2, attempt), 10000); // Max 10s
      
    case 'CONNECTION_POOL_ERROR':
      // Shorter backoff for pool issues
      return Math.min(baseDelay * attempt, 5000); // Linear, max 5s
      
    case 'AUTHENTICATION_ERROR':
      // Fixed delay for auth errors (unlikely to resolve quickly)
      return 3000;
      
    default:
      // Standard exponential backoff
      return Math.min(baseDelay * Math.pow(2, attempt - 1), 8000); // Max 8s
  }
}

/**
 * Record connection errors for monitoring and analysis
 */
function recordConnectionError(organizationId: string, category: string, duration: number, attempt: number): void {
  // In production, this could be sent to monitoring service
  const errorRecord = {
    timestamp: new Date().toISOString(),
    organizationId,
    category,
    duration,
    attempt,
    environment: process.env.NODE_ENV || 'development'
  };
  
  // For now, just log it - in production, send to monitoring service
  console.warn(`📊 [METRICS] Connection error recorded:`, errorRecord);
}

/**
 * Close organization-specific database connection with enhanced cleanup
 */
export async function closeOrgDbConnection(organizationId: string): Promise<void> {
  const cache = getConnectionCache(organizationId);
  
  if (cache.conn) {
    try {
      console.log(`🔐 [${organizationId}] Closing connection...`);
      await cache.conn.close();
      console.log(`✅ [${organizationId}] Connection closed successfully`);
    } catch (error) {
      console.error(`❌ [${organizationId}] Error closing connection:`, error);
    } finally {
      clearConnectionCache(organizationId);
      delete activeConnections[organizationId];
    }
  }
}

/**
 * Get connection statistics for monitoring
 */
export function getConnectionStats(): Record<string, any> {
  return {
    activeConnections: Object.keys(activeConnections).length,
    connectionIds: Object.keys(activeConnections),
    cacheStatus: Object.keys(connectionCache).map(orgId => ({
      organizationId: orgId,
      hasConnection: !!connectionCache[orgId].conn,
      hasPromise: !!connectionCache[orgId].promise,
      readyState: connectionCache[orgId].conn?.readyState || 'no connection'
    })),
    timestamp: new Date().toISOString()
  };
}

/**
 * Force cleanup of stale connections
 */
export async function cleanupStaleConnections(): Promise<void> {
  console.log('🧹 Starting stale connection cleanup...');
  
  for (const [orgId, connection] of Object.entries(activeConnections)) {
    if (connection.readyState !== 1) {
      console.log(`🗑️ Cleaning up stale connection for ${orgId} (state: ${connection.readyState})`);
      try {
        await connection.close();
      } catch (error) {
        console.error(`❌ Error closing stale connection for ${orgId}:`, error);
      }
      delete activeConnections[orgId];
      clearConnectionCache(orgId);
    }
  }
  
  console.log('✅ Stale connection cleanup completed');
}

export default dbConnect;
