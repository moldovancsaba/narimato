import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';

export async function GET() {
  try {
    await dbConnect();

    const cards = await Card.find().sort({ createdAt: -1 });

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Failed to fetch cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    );
  }
}
