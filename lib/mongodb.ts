import mongoose from 'mongoose';
import '@/models';  // Import all models to ensure proper registration

declare global {
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<any> | null;
  };
}

// Initialize global mongoose state
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

import { env } from '@/env.mjs';

const MONGODB_URI = env.MONGO_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

async function dbConnect() {
  // If we have a connection, return it
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is being established, wait for it
if (!cached.promise) {
    console.log('Establishing new MongoDB connection...');
    const opts = {
      bufferCommands: true,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('MongoDB connected successfully');
        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

export default dbConnect;

export const serializeDocument = <T>(doc: T): T => {
  return JSON.parse(JSON.stringify(doc));
};

export async function getMongoDb() {
  await dbConnect();
  return mongoose.connection.db;
}
