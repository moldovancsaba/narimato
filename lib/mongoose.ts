import mongoose from 'mongoose';

/**
 * MongoDB connection string from environment variables
 * Falls back to localhost if not provided
 */
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/narimato';

/**
 * Global flag to track connection status
 * Used to prevent multiple connection attempts
 */
let isConnected = false;

/**
 * Connects to MongoDB using Mongoose
 * Ensures only one connection is active at a time
 * 
 * @returns {Promise<void>}
 */
export async function connectToDB(): Promise<void> {
  // Return early if already connected
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    // Set strict query mode for better error detection
    mongoose.set('strictQuery', true);

    // Connect to MongoDB
    const db = await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });

    isConnected = !!db.connections[0].readyState;
    console.log('New MongoDB connection established');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Disconnects from MongoDB
 * Useful for cleanup in development and testing
 * 
 * @returns {Promise<void>}
 */
export async function disconnectFromDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Failed to disconnect from MongoDB:', error);
    throw error;
  }
}
