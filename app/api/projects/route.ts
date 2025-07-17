import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Project } from '@/models/Project';
import { validateProject, generateProjectSlug } from '@/lib/validations/project';
import dbConnect from '@/lib/mongodb';
import { getAuthSession } from '@/app/api/auth/[...nextauth]/route';
import { handleError, ValidationError } from '@/lib/errors';

/**
 * GET /api/projects
 * Retrieves a list of all projects accessible to the user
 */
export async function GET() {
  try {
    // Connect to MongoDB
    await dbConnect();

    // Fetch all non-deleted projects
    const projects = await Project.find()
      .select('_id name description slug settings cards')
      .sort({ createdAt: -1 })
      .lean();

    // Transform the data for the frontend
    const transformedProjects = projects.map((project: any) => ({
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      cardCount: project.cards?.length || 0,
      slug: project.slug,
      isPublic: project.settings?.visibility === 'public'
    }));

    return NextResponse.json(transformedProjects);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get or create session (handles both authenticated and anonymous)
    const session = await getAuthSession();
    if (!session?.user?.id) {
      throw new ValidationError('Authentication required');
    }

    // Connect to MongoDB
    await dbConnect();

    // Parse request body
    const body = await req.json();
    
    // Validate project data with authenticated user
    const validatedData = validateProject(body, {
      userId: session.user.id
    });

    // Generate slug if not provided
    if (!validatedData.slug) {
      console.log('[API] Generating project slug from name:', validatedData.name);
      validatedData.slug = generateProjectSlug(validatedData.name);
      console.log('[API] Generated project slug:', validatedData.slug);
    }

    // Create project data with authenticated user
    const projectData = {
      ...validatedData,
      createdBy: session.user.id,
      isAnonymous: false,
      createdAt: new Date().toISOString() // ISO 8601 format
    };
    
    console.log('[API] Creating new project with slug:', validatedData.slug);
    const project = await Project.create({
      ...projectData,
      updatedAt: projectData.createdAt,
      activity: [{
        type: 'created',
        timestamp: new Date(),
        userId: projectData.createdBy,
        details: { name: projectData.name }
      }]
    });

    // Return success response
    console.log(`[API] Successfully created project: ${project._id} with slug: ${project.slug}`);
    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      data: project
    }, { status: 201 });

  } catch (error) {
    return handleError(error);
  }
}
