import { NextRequest, NextResponse } from 'next/server';
import { LeaderboardService } from '@/lib/services/leaderboardService';
import { headers } from 'next/headers';
import { z } from 'zod';

// Force dynamic route - never cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;  // Disable caching

/**
 * Validation schema for leaderboard query parameters
 * Enforces type safety and provides default values for pagination
 *
 * @schema QuerySchema
 */
const QuerySchema = z.object({
  type: z.enum(['global', 'project', 'personal']).default('global'),
  projectId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

/**
 * GET /api/leaderboard
 * Retrieves leaderboard data based on the specified type and filters.
 *
 * @endpoint
 * @method GET
 * @param {NextRequest} request - The incoming HTTP request
 *
 * Query Parameters:
 * - type: 'global' | 'project' | 'personal' (default: 'global')
 * - projectId?: string (required for project type)
 * - page?: number (default: 1)
 * - limit?: number (default: 10, max: 50)
 *
 * Headers:
 * - session-id: Required for personal leaderboard
 *
 * @returns {Promise<NextResponse>} JSON response containing leaderboard data
 */
export async function GET(request: NextRequest) {
try {
    // Validate and coerce query parameters using Zod schema
    const url = new URL(request.url);
    const validatedParams = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    // Handle different leaderboard types with appropriate data fetching
    switch (validatedParams.type) {
// Global leaderboard - all cards ranked by score
      case 'global':
        const globalData = await LeaderboardService.getGlobalLeaderboard(
          validatedParams.limit,
          validatedParams.page
        );
        return NextResponse.json(globalData);

      // Project-specific leaderboard - cards ranked within a project
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

      default:
        return NextResponse.json(
          { message: 'Invalid leaderboard type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    
    // Handle validation errors separately from other errors
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
