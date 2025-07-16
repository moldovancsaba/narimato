import mongoose from 'mongoose';

/**
 * MongoDB connection configuration interface
 * Defines the structure for database connection options
 */
interface MongoDBConfig {
  uri: string;
  dbName?: string;
  options?: mongoose.ConnectOptions;
}

/**
 * Connection state tracking
 * Used to prevent multiple connection attempts and manage connection lifecycle
 */
class ConnectionState {
  private static instance: ConnectionState;
  private _isConnected: boolean = false;
  private _isConnecting: boolean = false;
  private _lastError: Error | null = null;

  private constructor() {}

  static getInstance(): ConnectionState {
    if (!ConnectionState.instance) {
      ConnectionState.instance = new ConnectionState();
    }
    return ConnectionState.instance;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isConnecting(): boolean {
    return this._isConnecting;
  }

  get lastError(): Error | null {
    return this._lastError;
  }

  setConnecting(value: boolean): void {
    this._isConnecting = value;
  }

  setConnected(value: boolean): void {
    this._isConnected = value;
    if (value) {
      this._isConnecting = false;
      this._lastError = null;
    }
  }

  setError(error: Error): void {
    this._lastError = error;
    this._isConnecting = false;
  }
}

/**
 * MongoDB connection manager
 * Handles database connection lifecycle and error handling
 */
export class MongoDBManager {
  private static instance: MongoDBManager;
  private readonly config: MongoDBConfig;
  private readonly state: ConnectionState;

  private constructor(config: MongoDBConfig) {
    this.config = config;
    this.state = ConnectionState.getInstance();

    // Configure mongoose settings
    mongoose.set('strictQuery', true);
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connection established');
      this.state.setConnected(true);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      this.state.setError(err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      this.state.setConnected(false);
    });

    // Handle process termination
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  /**
   * Get or create the MongoDB manager instance
   * Ensures only one connection manager exists
   */
  static getInstance(config?: MongoDBConfig): MongoDBManager {
    if (!MongoDBManager.instance) {
      if (!config) {
        throw new Error('MongoDB configuration required for initial setup');
      }
      MongoDBManager.instance = new MongoDBManager(config);
    }
    return MongoDBManager.instance;
  }

  /**
   * Connect to MongoDB
   * Handles connection lifecycle and error cases
   */
  async connect(): Promise<void> {
    // Return if already connected or connecting
    if (this.state.isConnected) {
      return;
    }

    if (this.state.isConnecting) {
      console.log('MongoDB connection already in progress');
      return;
    }

    try {
      this.state.setConnecting(true);

      // Attempt connection with retry logic
      await this.connectWithRetry();

    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.state.setError(error as Error);
      throw error;
    }
  }

  /**
   * Connect to MongoDB with retry logic
   * Attempts to connect multiple times before giving up
   */
  private async connectWithRetry(retries = 3, delay = 5000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await mongoose.connect(this.config.uri, {
          ...this.config.options,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        return;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        console.log(`Retrying connection in ${delay/1000} seconds... (Attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Clean up MongoDB connection
   * Ensures proper shutdown of database connections
   */
  async cleanup(): Promise<void> {
    if (this.state.isConnected) {
      try {
        await mongoose.disconnect();
        console.log('MongoDB disconnected through app termination');
      } catch (error) {
        console.error('Error during MongoDB cleanup:', error);
        process.exit(1);
      }
    }
    process.exit(0);
  }

  /**
   * Check connection health
   * Returns current connection state and any errors
   */
  getHealth(): { isConnected: boolean; lastError: Error | null } {
    return {
      isConnected: this.state.isConnected,
      lastError: this.state.lastError
    };
  }
}

// Create and export the MongoDB connection instance
const mongoConfig: MongoDBConfig = {
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017/narimato',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
};

export const mongodb = MongoDBManager.getInstance(mongoConfig);

/**
 * Helper function to ensure database connection
 * Use this in API routes and server-side code
 */
export async function connectToDB(): Promise<void> {
  await mongodb.connect();
}
