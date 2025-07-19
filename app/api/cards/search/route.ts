import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db/mongodb';
import { Card } from '@/models/Card';

/**
 * POST /api/cards/search
 * Searches and filters cards based on query parameters
 *
 * @param {object} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with filtered cards
 */
export async function POST(request: Request) {
  try {
    // Connect to database
    await connectToDB();

    // Parse request body
    const { query, filters } = await request.json();

    // Build search criteria
    const searchCriteria: any = {
      isDeleted: false // Only return non-deleted cards
    };

    // Add text search if query exists
    if (query?.trim()) {
      searchCriteria.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { hashtags: { $regex: query, $options: 'i' } }
      ];
    }

    // Add filter criteria
    if (filters) {
      // Filter by type
      if (filters.type && ['image', 'text'].includes(filters.type)) {
        searchCriteria.type = filters.type;
      }

      // Filter by hashtags
      if (filters.hashtags?.length) {
        searchCriteria.hashtags = { $all: filters.hashtags };
      }

      // Filter by minimum score
      if (typeof filters.minScore === 'number') {
        searchCriteria.globalScore = { $gte: filters.minScore };
      }

      // Filter by date range
      if (filters.dateRange) {
        searchCriteria.createdAt = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }
    }

    // Execute search query
    const cards = await Card.find(searchCriteria)
      .select('_id title description type hashtags globalScore createdAt') // Select only needed fields
      .sort({ globalScore: -1 }) // Sort by global score descending
      .limit(50) // Limit results for performance
      .lean(); // Return plain objects instead of Mongoose documents

    return NextResponse.json({
      success: true,
      cards,
      total: cards.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in card search:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search cards',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
