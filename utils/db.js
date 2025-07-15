import mongoose from 'mongoose';

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/narimato';
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000; // 5 seconds

// Schema Definitions
const CardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'text'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: function() { return this.type === 'image'; }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  cards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const RankingSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  cards: [{
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card'
    },
    rank: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update the updatedAt timestamp
const updateTimestamp = function(next) {
  this.updatedAt = new Date();
  next();
};

CardSchema.pre('save', updateTimestamp);
ProjectSchema.pre('save', updateTimestamp);
UserSchema.pre('save', updateTimestamp);
RankingSchema.pre('save', updateTimestamp);

// Model registration
const Card = mongoose.models.Card || mongoose.model('Card', CardSchema);
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Ranking = mongoose.models.Ranking || mongoose.model('Ranking', RankingSchema);

// Connection handler with retry logic
async function connectWithRetry(retries = MAX_RETRIES) {
  try {
    if (!mongoose.connections[0].readyState) {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('Successfully connected to MongoDB.');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    if (retries > 0) {
      console.log(`Retrying connection in ${RETRY_INTERVAL/1000} seconds... (${retries} attempts remaining)`);
      setTimeout(() => connectWithRetry(retries - 1), RETRY_INTERVAL);
    } else {
      console.error('Max retries reached. Could not connect to MongoDB.');
      process.exit(1);
    }
  }
}

// Health check function
async function checkMongoHealth() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'error',
        message: 'MongoDB disconnected',
        timestamp: new Date().toISOString()
      };
    }

    // Test the connection with a simple operation
    await mongoose.connection.db.admin().ping();
    
    return {
      status: 'healthy',
      message: 'MongoDB connected',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      message: `MongoDB health check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Event listeners for connection status
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Initialize connection
connectWithRetry();

// Export models and utilities
export {
  connectWithRetry,
  checkMongoHealth,
  Card,
  Project,
  User,
  Ranking
};
