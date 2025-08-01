import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';
import { CreateCardSchema } from '@/app/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = CreateCardSchema.parse(body);

    await dbConnect();

    const uuid = uuidv4();
    const md5 = createHash('md5').update(uuid).digest('hex');
    
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

    return NextResponse.json({ success: true, card });
  } catch (error) {
    console.error('Failed to create card:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create card' },
      { status: 400 }
    );
  }
}
