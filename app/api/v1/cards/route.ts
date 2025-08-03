import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/app/lib/utils/db';
import { Card, ICard, BackgroundStyle } from '@/app/lib/models/Card';
import { getChildren, getPlayableCards, getRootDecks, isValidHashtag, isHashtagTaken, isPlayable } from '@/app/lib/utils/cardHierarchy';

/**
 * GET /api/v1/cards
 * Retrieve cards with filtering, searching, and hierarchy information
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type'); // 'root', 'playable', 'all'
    const parent = searchParams.get('parent'); // Get children of specific parent

    let query: any = { isActive: true };
    let cards: ICard[] = [];

    // Build query based on type
    if (type === 'root') {
      cards = await getRootDecks();
    } else if (type === 'playable') {
      cards = await getPlayableCards();
    } else if (parent) {
      cards = await getChildren(parent);
    } else {
      // Default: get all cards
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { 'body.textContent': { $regex: search, $options: 'i' } },
          { hashtags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      const skip = (page - 1) * limit;
      cards = await Card.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    // Add hierarchy information to each card
    const cardsWithMeta = await Promise.all(
      cards.map(async (card) => {
        const children = await getChildren(card.name);
        // Handle both Mongoose documents and plain objects
        const cardObj = typeof card.toObject === 'function' ? card.toObject() : card;
        return {
          ...cardObj,
          childCount: children.length,
          // Use consistent playability logic that enforces minimum card threshold
          // This ensures UI display matches backend filtering requirements
          isPlayable: await isPlayable(card.name),
          isRoot: !card.hashtags || card.hashtags.length === 0
        };
      })
    );

    const total = await Card.countDocuments(query);

    return NextResponse.json({
      success: true,
      cards: cardsWithMeta,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Cards fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch cards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/cards
 * Create or update a card with three operation types:
 * - SAVE: Update card data only
 * - GENERATE: Create preview and upload to ImgBB
 * - IMGONLY: Use external image URL
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      uuid,
      name,
      body: cardBody,
      hashtags,
      operation = 'SAVE' // SAVE, GENERATE, IMGONLY
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Card name is required' },
        { status: 400 }
      );
    }

    // Validate hashtag format
    if (!isValidHashtag(name)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hashtag format. Must start with # and contain only letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    // Validate hashtags array
    if (hashtags && hashtags.length > 0) {
      for (const hashtag of hashtags) {
        if (!isValidHashtag(hashtag)) {
          return NextResponse.json(
            { success: false, error: `Invalid hashtag format: ${hashtag}` },
            { status: 400 }
          );
        }
        
        // Check if referenced hashtag exists
        const hashtagExists = await Card.findOne({ name: hashtag, isActive: true });
        if (!hashtagExists) {
          return NextResponse.json(
            { success: false, error: `Referenced hashtag does not exist: ${hashtag}` },
            { status: 400 }
          );
        }
      }
    }

    let card: ICard | null;
    let isUpdate = false;

    if (uuid) {
      // Update existing card
      card = await Card.findOne({ uuid, isActive: true });
      if (!card) {
        return NextResponse.json(
          { success: false, error: 'Card not found' },
          { status: 404 }
        );
      }
      isUpdate = true;
      
      // Check if name is changing and if new name is available
      if (card.name !== name) {
        const nameExists = await isHashtagTaken(name);
        if (nameExists) {
          return NextResponse.json(
            { success: false, error: 'Hashtag name already exists' },
            { status: 409 }
          );
        }
      }
    } else {
      // Create new card
      const nameExists = await isHashtagTaken(name);
      if (nameExists) {
        return NextResponse.json(
          { success: false, error: 'Hashtag name already exists' },
          { status: 409 }
        );
      }

      card = new Card({
        uuid: uuidv4(),
        name,
        body: cardBody || {},
        hashtags: hashtags || [],
        isActive: true
      });
    }

    // At this point, card is guaranteed to be not null due to the checks above
    if (!card) {
      throw new Error('Card should not be null at this point');
    }

    // Handle different operations
    switch (operation) {
      case 'SAVE':
        // Update card data only
        if (isUpdate) {
          card.name = name;
          card.body = { ...card.body, ...cardBody };
          card.hashtags = hashtags || [];
          card.updatedAt = new Date();
        }
        break;

      case 'GENERATE':
        // TODO: Implement preview generation and ImgBB upload
        // For now, just save the data
        if (isUpdate) {
          card.name = name;
          card.body = { ...card.body, ...cardBody };
          card.hashtags = hashtags || [];
          card.updatedAt = new Date();
        }
        // Here you would:
        // 1. Generate preview image from card data
        // 2. Upload to ImgBB
        // 3. Set card.body.imageUrl to the uploaded URL
        break;

      case 'IMGONLY':
        // Use external image URL
        if (!cardBody?.imageUrl) {
          return NextResponse.json(
            { success: false, error: 'Image URL is required for IMGONLY operation' },
            { status: 400 }
          );
        }
        
        if (isUpdate) {
          card.name = name;
          card.body = { ...card.body, ...cardBody };
          card.hashtags = hashtags || [];
          card.updatedAt = new Date();
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation. Must be SAVE, GENERATE, or IMGONLY' },
          { status: 400 }
        );
    }

    await card.save();

    // Get updated card with hierarchy info
    const children = await getChildren(card.name);
    const cardResponse = {
      ...card.toObject(),
      childCount: children.length,
      // Use consistent playability logic that enforces minimum card threshold
      isPlayable: await isPlayable(card.name),
      isRoot: !card.hashtags || card.hashtags.length === 0
    };

    return NextResponse.json(
      {
        success: true,
        message: isUpdate ? 'Card updated successfully' : 'Card created successfully',
        card: cardResponse,
        operation
      },
      { status: isUpdate ? 200 : 201 }
    );

  } catch (error) {
    console.error('Card operation error:', error);
    
    // Handle validation errors
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.message
        },
        { status: 400 }
      );
    }

    // Handle duplicate key errors
    if (error instanceof Error && 'code' in error && (error as any).code === 11000) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Card with this name or UUID already exists'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process card operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
