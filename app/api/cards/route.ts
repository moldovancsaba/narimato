import { NextResponse, NextRequest } from 'next/server';
import { Card } from '@/models';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
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

export async function GET(request: NextRequest) {
  try {
    const searchTerm = request.nextUrl.searchParams.get('search');
    await dbConnect();

    // If there's a search term, search for matching cards
    if (searchTerm) {
      const cards = await Card.find({
        isDeleted: false,
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { content: { $regex: searchTerm, $options: 'i' } },
        ]
      })
      .select('_id title type content')
      .limit(10)
      .lean();

      return NextResponse.json(cards);
    }

    // If no search term, return all cards
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

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
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
