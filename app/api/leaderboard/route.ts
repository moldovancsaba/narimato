import { NextRequest, NextResponse } from 'next/server';
import { LeaderboardService } from '@/lib/services/leaderboardService';
import { z } from 'zod';

// Query parameters schema
const QuerySchema = z.object({
  type: z.enum(['global', 'project', 'personal']).default('global'),
  projectId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const validatedParams = QuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

    switch (validatedParams.type) {
      case 'global':
        const globalData = await LeaderboardService.getGlobalLeaderboard(
          validatedParams.limit,
          validatedParams.page
        );
        return NextResponse.json(globalData);

      case 'project':
        if (!validatedParams.projectId) {
          return NextResponse.json(
            { message: 'Project ID is required for project leaderboard' },
            { status: 400 }
          );
        }
        const projectData = await LeaderboardService.getProjectLeaderboard(
          validatedParams.projectId,
          validatedParams.limit,
          validatedParams.page
        );
        return NextResponse.json(projectData);

      case 'personal':
        const sessionId = request.headers.get('session-id');
        if (!sessionId) {
          return NextResponse.json(
            { message: 'Session ID is required for personal leaderboard' },
            { status: 400 }
          );
        }
        const personalData = await LeaderboardService.getPersonalRankings(
          sessionId,
          validatedParams.projectId,
          validatedParams.limit,
          validatedParams.page
        );
        return NextResponse.json(personalData);

      default:
        return NextResponse.json(
          { message: 'Invalid leaderboard type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid request parameters', errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
