import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { GlobalRanking } from '@/app/lib/models/GlobalRanking';
import { CreateCardSchema } from '@/app/lib/validation/schemas';
import { handleApiError } from '@/app/lib/utils/errorHandling';
import { validateUUID } from '@/app/lib/utils/fieldValidation';

export const POST = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const body = await request.json();
    const validatedData = CreateCardSchema.parse(body);

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    
    // Register connection-specific models
    const CardModel = connection.model('Card', Card.schema);
    const GlobalRankingModel = connection.model('GlobalRanking', GlobalRanking.schema);

    // Use provided UUID or generate new one
    const uuid = validatedData.uuid && validateUUID(validatedData.uuid) ? validatedData.uuid : uuidv4();
    
    // Check for UUID uniqueness
    const existingCard = await CardModel.findOne({ uuid });
    if (existingCard) {
      return NextResponse.json(
        { error: 'Card with this UUID already exists' },
        { status: 409 }
      );
    }
    
    // Check for name uniqueness (hashtag must be unique)
    const existingName = await CardModel.findOne({ name: validatedData.name });
    if (existingName) {
      console.error(`❌ Card creation failed - duplicate name: ${validatedData.name} (Organization: ${organizationUUID})`);
      return NextResponse.json(
        { error: `Card with this name (hashtag) already exists: ${validatedData.name}` },
        { status: 409 }
      );
    }
    
    const card = new CardModel({
      uuid,
      ...validatedData,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await card.save();
    
    
    // ✅ CRITICAL FIX: Initialize ELO rating for new card to prevent ranking sync issues
    try {
      const existingRanking = await GlobalRankingModel.findOne({ cardUUID: uuid });
      if (!existingRanking) {
        const newRanking = new GlobalRankingModel({
          cardUUID: uuid,
          eloRating: 1000, // Default ELO rating
          totalScore: 0,
          appearanceCount: 0,
          averageRank: 0,
          wins: 0,
          losses: 0,
          totalGames: 0,
          winRate: 0,
          lastUpdated: new Date()
        });
        
        await newRanking.save();
        console.log(`✅ Initialized ELO rating (1000) for new card: ${uuid}`);
      } else {
        console.log(`ℹ️ ELO rating already exists for card: ${uuid}`);
      }
    } catch (rankingError) {
      console.error(`⚠️ Failed to initialize ELO rating for card ${uuid}:`, rankingError);
      // Don't fail card creation if ranking initialization fails
    }

    return NextResponse.json({ success: true, card });
  } catch (error) {
    console.error('Failed to create card:', error);
    
    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: (error as any).errors.map((e: any) => ({ 
            field: e.path.join('.'), 
            message: e.message 
          }))
        },
        { status: 400 }
      );
    }
    
    // Handle duplicate key errors (MongoDB)
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json(
        { error: 'Duplicate card detected - slug or UUID already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create card' },
      { status: 500 }
    );
  }
});
