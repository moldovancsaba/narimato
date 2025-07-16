import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Project } from '@/models/Project';
import { validateProject, generateProjectSlug } from '@/lib/validations/project';
import { connectToDB } from '@/lib/mongoose';
import { getAuthSession } from '@/app/api/auth/[...nextauth]/route';
import { handleError, ValidationError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    // Get or create session (handles both authenticated and anonymous)
    const session = await getAuthSession();
    if (!session?.user?.id) {
      throw new ValidationError('Authentication required');
    }

    // Connect to MongoDB
    await connectToDB();

    // Parse request body
    const body = await req.json();
    
    // Validate project data with authenticated user
    const validatedData = validateProject(body, {
      userId: session.user.id
    });

    // Generate slug if not provided
    if (!validatedData.slug) {
      validatedData.slug = generateProjectSlug(validatedData.name);
    }

    // Create project data with authenticated user
    const projectData = {
      ...validatedData,
      createdBy: session.user.id,
      isAnonymous: false,
      createdAt: new Date().toISOString() // ISO 8601 format
    };
    
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
    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      data: project
    }, { status: 201 });

  } catch (error) {
    return handleError(error);
  }
}
