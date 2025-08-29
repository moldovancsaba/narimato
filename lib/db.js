const mongoose = require('mongoose');

let connection = null;

async function connectDB() {
  if (connection && connection.readyState === 1) {
    return connection;
  }

  try {
    connection = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    
    console.log('✅ MongoDB connected');
    return connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

module.exports = { connectDB };
