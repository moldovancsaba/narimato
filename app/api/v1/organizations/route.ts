import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '../../../lib/utils/db';
import Organization from '../../../lib/models/Organization';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/v1/organizations
 */
export async function GET() {
  try {
    await connectMasterDb();
    
    const organizations = await Organization.find({ isActive: true })
      .select('uuid displayName slug description createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(30000); // 30 second timeout for operations

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/organizations
 */
export async function POST(request: NextRequest) {
  try {
    await connectMasterDb();
    
    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check if slug already exists
    const existingOrg = await Organization.findOne({ slug, isActive: true })
      .maxTimeMS(30000); // 30 second timeout for operations
    if (existingOrg) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }

    // Create new organization
    const organizationUuid = uuidv4();
    const organization = new Organization({
      uuid: organizationUuid,
      displayName: name,
      slug: slug,
      databaseName: organizationUuid, // Use UUID as database name
      description: body.description || '',
      isActive: true
    });

    await organization.save();

    return NextResponse.json({
      organization: {
        uuid: organization.uuid,
        displayName: organization.displayName,
        slug: organization.slug,
        description: organization.description,
        createdAt: organization.createdAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
