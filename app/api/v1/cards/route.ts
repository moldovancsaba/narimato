import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/v1/cards
 */
export async function GET(request: NextRequest) {
  try {
    // For now, return empty array since we need to fix the database connection
    return NextResponse.json({ cards: [] });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}

/**
 * POST /api/v1/cards
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // For now, just return success - we need to fix database connection
    const card = {
      uuid: uuidv4(),
      name: body.name,
      content: body.content
    };

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error creating card:', error);
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}
