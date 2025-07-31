import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { API_FIELDS, CARD_FIELDS } from '@/app/lib/constants/fieldNames';

export async function GET() {
  try {
    await dbConnect();

    // Aggregate cards by tags to create deck options
    const deckStats = await Card.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$tags' }, // Separate each tag into its own document
      { 
        $group: {
          _id: '$tags', // Group by tag
          cardCount: { $sum: 1 }, // Count cards in each tag
          cards: { $push: '$uuid' } // Collect card UUIDs for validation
        }
      },
      { $match: { cardCount: { $gte: 2 } } }, // Only include tags with at least 2 cards
      { $sort: { cardCount: -1 } }, // Sort by card count (descending)
      {
        $project: {
          _id: 0,
          tag: '$_id',
          cardCount: 1
        }
      }
    ]);

    // Add an "All Cards" deck option
    const totalCards = await Card.countDocuments({ isActive: true });
    
    const decks = [
      {
        tag: 'all',
        cardCount: totalCards,
        displayName: 'All Cards'
      },
      ...deckStats.map(deck => ({
        tag: deck.tag,
        cardCount: deck.cardCount,
        displayName: `#${deck.tag}`
      }))
    ];

    return new NextResponse(
      JSON.stringify({
        success: true,
        decks
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    console.error('Decks fetch error:', error);
    return new NextResponse(
      JSON.stringify({ [API_FIELDS.ERROR]: 'Internal server error' }),
      { status: 500 }
    );
  }
}
