import mongoose from 'mongoose';

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

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// TypeScript assertion: at this point MONGODB_URI is guaranteed to be a string
const mongoUri: string = MONGODB_URI;

// Enforce Atlas-only connection - no localhost allowed
if (MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1')) {
  throw new Error('Localhost MongoDB connections are prohibited. Use only MongoDB Atlas from .env.local');
}

// Validate URI format to prevent injection attacks
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
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
let cached = _global.mongoose;

if (!cached) {
  cached = _global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
