const mongoose = require('mongoose');

let connection = null;

async function connectDB() {
  if (connection && connection.readyState === 1) {
    return connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
    const err = new Error('Missing MONGODB_URI. Please set your MongoDB Atlas connection string in .env.local');
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
  if (!uri.startsWith('mongodb+srv://')) {
    const err = new Error('Invalid MONGODB_URI scheme. Only MongoDB Atlas (mongodb+srv://) is allowed.');
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }

  try {
    connection = await mongoose.connect(uri, {
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
