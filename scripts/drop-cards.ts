import { connect } from 'mongoose';

async function dropCards() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/narimato';
    const conn = await connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await conn.connection.collection('cards').drop();
    console.log('Dropped cards collection');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropCards();
