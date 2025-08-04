import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '@/app/lib/utils/db';
import Organization from '@/app/lib/models/Organization';

/**
 * POST /api/v1/admin/organizations
 * Create a new organization with validation
 */
export async function POST(request: NextRequest) {
  try {
    await connectMasterDb();

    const body = await request.json();
    if (!body.name || !body.slug || !body.databaseName) {
      return NextResponse.json(
        { success: false, error: 'Name, slug, and databaseName are required' },
        { status: 400 }
      );
    }

    const existingOrg = await Organization.findOne({ slug: body.slug });
    if (existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Slug already in use' },
        { status: 409 }
      );
    }

    const newOrg = await Organization.create({
      name: body.name,
      slug: body.slug,
      databaseName: body.databaseName
    });

    return NextResponse.json({
      success: true,
      message: 'Organization created successfully',
      organization: newOrg.toObject()
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create organization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
