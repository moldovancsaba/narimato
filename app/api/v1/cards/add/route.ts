import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { GlobalRanking } from '@/app/lib/models/GlobalRanking';
import { CreateCardSchema } from '@/app/lib/validation/schemas';
import { handleApiError } from '@/app/lib/utils/errorHandling';
import { validateUUID } from '@/app/lib/utils/fieldValidation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = CreateCardSchema.parse(body);

    await dbConnect();

    // Use provided UUID or generate new one
    const uuid = validatedData.uuid && validateUUID(validatedData.uuid) ? validatedData.uuid : uuidv4();
    const md5 = createHash('md5').update(uuid).digest('hex');
    
    // Check for UUID uniqueness
    const existingCard = await Card.findOne({ uuid });
    if (existingCard) {
      return NextResponse.json(
        { error: 'Card with this UUID already exists' },
        { status: 409 }
      );
    }
    
    // Generate base slug from title or use md5
    let baseSlug = validatedData.title ? 
      validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 
      md5.substring(0, 8);
    
    // Ensure slug uniqueness by checking for duplicates
    let slug = baseSlug;
    let counter = 1;
    while (await Card.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    const card = new Card({
      uuid,
      md5,
      slug,
      ...validatedData,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await card.save();
    
    // ✅ CRITICAL FIX: Initialize ELO rating for new card to prevent ranking sync issues
    try {
      const existingRanking = await GlobalRanking.findOne({ cardId: uuid });
      if (!existingRanking) {
        const newRanking = new GlobalRanking({
          cardId: uuid,
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
}
