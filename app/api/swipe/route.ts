import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Card } from '@/models/Card';
import { z } from 'zod';

const SwipeSchema = z.object({
  cardId: z.string(),
  direction: z.enum(['left', 'right']),
  projectId: z.string(),
});

import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { cardId, direction, projectId } = SwipeSchema.parse(body);
    
    // Verify the card belongs to the specified project
    const card = await Card.findOne({ _id: cardId, projectId });

    if (!card) {
      return NextResponse.json(
        { message: 'Card not found or does not belong to the specified project' },
        { status: 404 }
      );
    }

    // Update overall card metrics
    if (direction === 'right') {
      card.likes = (card.likes || 0) + 1;
    } else {
      card.dislikes = (card.dislikes || 0) + 1;
    }

    await card.save();

    return NextResponse.json({ 
      success: true
    });
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
