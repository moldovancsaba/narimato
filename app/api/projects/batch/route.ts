import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Project } from '@/models/Project';

/**
 * POST /api/projects/batch
 * Retrieves multiple projects by their IDs
 */
export async function POST(request: Request) {
  try {
    const { projectIds } = await request.json();
    await dbConnect();

    // Validate input
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid project IDs provided' },
        { status: 400 }
      );
    }

    // Fetch projects
    const projects = await Project.find({
      _id: { $in: projectIds },
      'settings.visibility': 'public', // Only fetch public projects
    }).select('name slug'); // Only select necessary fields

    return NextResponse.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('[API] Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
