import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Card, ICard, BackgroundStyle } from '@/app/lib/models/Card';
import { getChildren, getPlayableCards, getRootDecks, isValidHashtag, isHashtagTaken, isPlayable } from '@/app/lib/utils/cardHierarchy';
import { CreateCardSchema, UpdateCardSchema } from '@/app/lib/validation/schemas';
import { handleApiError } from '@/app/lib/utils/errorHandling';

/**
 * GET /api/v1/cards
 * Retrieve cards with filtering, searching, and hierarchy information
 */
export const GET = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Get Card model bound to this specific connection
    const CardModel = connection.model('Card', Card.schema);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type'); // 'root', 'playable', 'all'
    const parent = searchParams.get('parent'); // Get children of specific parent
    const last = searchParams.get('last'); // Get last created card for defaults

    let query: any = { isActive: true };
    let cards: ICard[] = [];

    // Build query based on type
    if (last === 'true') {
      // Get the most recently created card for default values
      const lastCard = await CardModel.findOne(query)
        .sort({ createdAt: -1 })
        .limit(1);
      
      return NextResponse.json({
        success: true,
        card: lastCard || null
      });
    } else if (type === 'root') {
      cards = await getRootDecks(organizationUUID);
    } else if (type === 'playable') {
      cards = await getPlayableCards(organizationUUID);
    } else if (parent) {
      cards = await getChildren(organizationUUID, parent);
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
      cards = await CardModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    // Add hierarchy information to each card
    const cardsWithMeta = await Promise.all(
      cards.map(async (card) => {
        const children = await getChildren(organizationUUID, card.name);
        // Handle both Mongoose documents and plain objects
        const cardObj = typeof card.toObject === 'function' ? card.toObject() : card;
        return {
          ...cardObj,
          childCount: children.length,
          // Use consistent playability logic that enforces minimum card threshold
          // This ensures UI display matches backend filtering requirements
          isPlayable: await isPlayable(organizationUUID, card.name),
          isRoot: !card.hashtags || card.hashtags.length === 0
        };
      })
    );

    const total = await CardModel.countDocuments(query);

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
});

/**
 * POST /api/v1/cards
 * Create a new card with comprehensive validation and meta field computation
 * Supports both text and media cards with flexible content structure
 */
export const POST = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Get Card model bound to this specific connection
    const CardModel = connection.model('Card', Card.schema);

    const body = await request.json();
    
    // Validate request body using Zod schema
    const validationResult = CreateCardSchema.safeParse(body);
    if (!validationResult.success) {
      console.warn('📋 Card creation validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    const validatedData = validationResult.data;
    console.log('📋 Creating card with validated data:', { name: validatedData.name, uuid: validatedData.uuid });

    // Check if card name (hashtag) is already taken
    const nameExists = await isHashtagTaken(organizationUUID, validatedData.name);
    if (nameExists) {
      console.warn('📋 Card name already exists:', validatedData.name);
      return NextResponse.json(
        { success: false, error: 'Card name (hashtag) already exists' },
        { status: 409 }
      );
    }

    // Validate hashtag references exist and prevent circular references
    if (validatedData.hashtags && validatedData.hashtags.length > 0) {
      // Prevent self-reference
      if (validatedData.hashtags.includes(validatedData.name)) {
        return NextResponse.json(
          { success: false, error: 'Card cannot reference itself as a parent hashtag' },
          { status: 400 }
        );
      }
      
      // Check if referenced hashtags exist
      const existingParents = await CardModel.find({ 
        name: { $in: validatedData.hashtags }, 
        isActive: true 
      }).select('name');
      
      const foundParentNames = existingParents.map(p => p.name);
      const missingParents = validatedData.hashtags.filter(h => !foundParentNames.includes(h));
      
      if (missingParents.length > 0) {
        console.warn('📋 Referenced parent hashtags not found:', missingParents);
        return NextResponse.json(
          { 
            success: false, 
            error: `Referenced parent hashtags do not exist: ${missingParents.join(', ')}` 
          },
          { status: 400 }
        );
      }
    }

    // Create new card with validated data
    const cardUuid = validatedData.uuid || uuidv4();
    
    // Check UUID uniqueness if provided
    if (validatedData.uuid) {
      const existingCard = await CardModel.findOne({ uuid: cardUuid });
      if (existingCard) {
        return NextResponse.json(
          { success: false, error: 'Card with this UUID already exists' },
          { status: 409 }
        );
      }
    }
    
    const card = new CardModel({
      uuid: cardUuid,
      name: validatedData.name,
      body: validatedData.body || {
        background: {
          type: 'color',
          value: '#667eea',
          textColor: '#ffffff'
        }
      },
      hashtags: validatedData.hashtags || [],
      cardSize: validatedData.cardSize,
      children: validatedData.children || [],
      isActive: validatedData.isActive
    });
    
    console.log('📋 Saving new card:', { uuid: cardUuid, name: validatedData.name });

    // Save the card
    await card.save();
    console.log('📋 Card saved successfully:', cardUuid);

    // Compute meta fields for response
    const cardChildren = await getChildren(organizationUUID, card.name);
    const cardResponse = {
      ...card.toObject(),
      childCount: cardChildren.length,
      isPlayable: await isPlayable(organizationUUID, card.name),
      isRoot: !card.hashtags || card.hashtags.length === 0
    };

    return NextResponse.json(
      {
        success: true,
        message: 'Card created successfully',
        card: cardResponse
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('📋 Card creation failed:', error);
    return handleApiError(error, 'Failed to create card');
  }
});

/**
 * PATCH /api/v1/cards/:uuid
 * Update an existing card with partial data
 * This endpoint should be used instead of POST for updates
 */
export const PATCH = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    const CardModel = connection.model('Card', Card.schema);
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');
    
    if (!uuid) {
      return NextResponse.json(
        { success: false, error: 'Card UUID is required for updates' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body using update schema
    const validationResult = UpdateCardSchema.safeParse(body);
    if (!validationResult.success) {
      console.warn('📋 Card update validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }
    
    const validatedData = validationResult.data;
    console.log('📋 Updating card:', { uuid, changes: Object.keys(validatedData) });
    
    // Find existing card
    const existingCard = await CardModel.findOne({ uuid, isActive: true });
    if (!existingCard) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }
    
    // Check name uniqueness if name is being changed
    if (validatedData.name && validatedData.name !== existingCard.name) {
      const nameExists = await isHashtagTaken(organizationUUID, validatedData.name);
      if (nameExists) {
        return NextResponse.json(
          { success: false, error: 'Card name (hashtag) already exists' },
          { status: 409 }
        );
      }
    }
    
    // Validate hashtag references if being updated
    if (validatedData.hashtags && validatedData.hashtags.length > 0) {
      const cardName = validatedData.name || existingCard.name;
      
      if (validatedData.hashtags.includes(cardName)) {
        return NextResponse.json(
          { success: false, error: 'Card cannot reference itself as a parent hashtag' },
          { status: 400 }
        );
      }
      
      const existingParents = await CardModel.find({ 
        name: { $in: validatedData.hashtags }, 
        isActive: true 
      }).select('name');
      
      const foundParentNames = existingParents.map(p => p.name);
      const missingParents = validatedData.hashtags.filter(h => !foundParentNames.includes(h));
      
      if (missingParents.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Referenced parent hashtags do not exist: ${missingParents.join(', ')}` 
          },
          { status: 400 }
        );
      }
    }
    
    // Apply updates
    Object.assign(existingCard, validatedData);
    existingCard.updatedAt = new Date();
    
    await existingCard.save();
    console.log('📋 Card updated successfully:', uuid);
    
    // Compute meta fields for response
    const cardChildren = await getChildren(organizationUUID, existingCard.name);
    const cardResponse = {
      ...existingCard.toObject(),
      childCount: cardChildren.length,
      isPlayable: await isPlayable(organizationUUID, existingCard.name),
      isRoot: !existingCard.hashtags || existingCard.hashtags.length === 0
    };
    
    return NextResponse.json({
      success: true,
      message: 'Card updated successfully',
      card: cardResponse
    });
    
  } catch (error) {
    console.error('📋 Card update failed:', error);
    return handleApiError(error, 'Failed to update card');
  }
});
