import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';

// Load environment variables
config();

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGO_URI environment variable');
}

async function dbConnect() {
  if (!MONGODB_URI) return; // TypeScript safety check
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}
import { Card } from '@/models/Card';

const testCards = [
  {
    title: 'Test Card 1',
    content: 'This is a test card with some text content.',
    type: 'text',
    description: 'A sample text card for testing',
    hashtags: ['#test', '#sample'],
    slug: 'test-card-1',
    globalScore: 1500,
  },
  {
    title: 'Test Card 2',
    content: 'Another test card with different content.',
    type: 'text',
    description: 'Another sample card for testing',
    hashtags: ['#test', '#example'],
    slug: 'test-card-2',
    globalScore: 1500,
  },
  {
    title: 'Test Image Card',
    content: 'https://picsum.photos/500/300',
    type: 'image',
    description: 'A sample image card for testing',
    hashtags: ['#test', '#image'],
    slug: 'test-image-card',
    imageAlt: 'Random test image',
    globalScore: 1500,
  },
];

async function generateTestCards() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');

    const existingCount = await Card.countDocuments({ isDeleted: false });
    console.log(`Found ${existingCount} existing cards`);

    if (existingCount === 0) {
      console.log('No cards found, generating test cards...');
      for (const card of testCards) {
        const newCard = new Card(card);
        await newCard.save();
        console.log(`Created card: ${card.title}`);
      }
      console.log('Test cards generated successfully');
    } else {
      console.log('Cards already exist, skipping test data generation');
    }
  } catch (error) {
    console.error('Error generating test cards:', error);
  }
}

generateTestCards();
