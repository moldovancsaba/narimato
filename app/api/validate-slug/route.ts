import { NextResponse } from 'next/server';
import { isSlugUnique } from '@/lib/validations/slug';

export async function POST(request: Request) {
  try {
    const { slug, collection, currentId } = await request.json();

    if (!slug || !collection) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['cards', 'projects'].includes(collection)) {
      return NextResponse.json(
        { error: 'Invalid collection' },
        { status: 400 }
      );
    }

    const isUnique = await isSlugUnique(
      slug,
      collection as 'cards' | 'projects',
      currentId
    );

    return NextResponse.json({ isUnique });
  } catch (error) {
    console.error('Error validating slug:', error);
    return NextResponse.json(
      { error: 'Failed to validate slug' },
      { status: 500 }
    );
  }
}
