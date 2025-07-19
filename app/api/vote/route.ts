import { NextResponse } from 'next/server';
import { recordVoteInDb, VoteData } from './service';
import { createLogger } from '@/lib/logger';
import { voteSchema } from '@/lib/vote/validation';
import { ZodError } from 'zod';
import { NextRequest } from 'next/server';

// Configure route to not use edge runtime since we need access to mongoose
export const runtime = 'nodejs';

const logger = createLogger('vote-api');

export async function POST(request: NextRequest) {
  try {
    const voteData = await request.json();
    
    // Validate request data against schema
    const validatedData = voteSchema.parse(voteData);

    const result = await recordVoteInDb(validatedData as VoteData);

    logger.info('Vote recorded successfully', {
      winnerId: validatedData.winnerId,
      loserId: validatedData.loserId,
      projectId: validatedData.projectId
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('Vote validation failed', {
        errors: error.errors
      });
      return NextResponse.json(
        { error: 'Invalid vote data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Vote recording failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}
