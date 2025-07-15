import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Card } from '@/models/Card';
import { z } from 'zod';

const SwipeSchema = z.object({
  cardId: z.string(),
  direction: z.enum(['left', 'right']),
});

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { cardId, direction } = SwipeSchema.parse(body);

    // Find the card
    const card = await Card.findById(cardId);
    if (!card) {
      return NextResponse.json(
        { message: 'Card not found' },
        { status: 404 }
      );
    }

    // Update like/dislike count based on swipe direction
    if (direction === 'right') {
      card.likes = (card.likes || 0) + 1;
    } else {
      card.dislikes = (card.dislikes || 0) + 1;
    }

    await card.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing swipe:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid request data', errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
