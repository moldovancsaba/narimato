import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Card } from '@/models/Card';

export async function GET() {
  try {
    await dbConnect();

    // Get a random card that hasn't reached 2 likes yet
    const card = await Card.aggregate([
      { $match: { isDeleted: false, likes: { $lt: 2 } } },
      { $sample: { size: 1 } },
    ]).exec();

    if (!card || card.length === 0) {
      return NextResponse.json(
        { message: 'No cards available' },
        { status: 404 }
      );
    }

    return NextResponse.json(card[0]);
  } catch (error) {
    console.error('Error fetching random card:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
