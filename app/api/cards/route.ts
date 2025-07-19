import { NextResponse, NextRequest } from 'next/server';
import { Card } from '@/models/Card';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { z } from 'zod';
import { slugify } from '@/lib/utils/slugify';
import { generateMD5 } from '@/lib/utils/md5';

// Schema validation for card creation
const CardSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['text', 'image']),
  hashtags: z.array(z.string()),
  imageAlt: z.string().optional(),
  slug: z.string().optional(),
  projectRankings: z.array(
    z.object({
      projectId: z.string(),
      rank: z.number(),
    })
  ).optional(),
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
    const body = await request.json();
    
    // Validate the request body
    const validatedData = CardSchema.parse(body);
    
    await dbConnect();

    // Generate MD5 from content - this will be our _id
    const md5 = generateMD5(validatedData.content);
    
    // Check if content already exists
    const existingCard = await Card.findById(md5);
    if (existingCard && !existingCard.isDeleted) {
      return NextResponse.json(
        { message: 'A card with this content already exists.' },
        { status: 400 }
      );
    }

    // Generate a display-friendly slug
    const baseSlug = slugify(validatedData.title);
    
    // Create the new card using MD5 as _id
    const card = new Card({
      _id: md5,
      ...validatedData,
      slug: baseSlug,
      isDeleted: false
    });
    
    await card.save();
    
    return NextResponse.json({
      success: true,
      message: 'Card created successfully',
      data: card
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
