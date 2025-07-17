import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Card } from '@/models/Card';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  console.log(`[API] GET /api/cards/${params.slug} - Fetching card by slug`);
  try {
    await dbConnect();

    console.log(`[API] Executing database query for card slug: ${params.slug}`);
    const card = await Card.findOne({ slug: params.slug, isDeleted: false });

    if (!card) {
      console.warn(`[API] Card not found with slug: ${params.slug}`);
      return NextResponse.json(
        { message: 'Card not found' },
        { status: 404 }
      );
    }

    console.log(`[API] Successfully retrieved card: ${card._id}`);
    return NextResponse.json(card);
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
