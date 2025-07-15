import { NextResponse } from 'next/server';
import { Card } from '@/models/Card';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { z } from 'zod';

// Schema validation for card creation
const CardSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['text', 'image']),
  hashtags: z.array(z.string()),
  imageAlt: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    
    // Validate the request body
    const validatedData = CardSchema.parse(body);

    // Generate a slug from the title
    const slug = validatedData.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug already exists
    const existingCard = await Card.findOne({ slug });
    if (existingCard) {
      return NextResponse.json(
        { message: 'A card with this title already exists' },
        { status: 409 }
      );
    }

    // Create the card
    const card = new Card({
      ...validatedData,
      slug,
    });

    await card.save();

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error('Error creating card:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof mongoose.Error) {
      return NextResponse.json(
        { message: 'Database error' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    
    const cards = await Card.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(100);
      
    return NextResponse.json(cards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
