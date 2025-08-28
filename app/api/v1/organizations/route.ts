import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '@/app/lib/utils/db';
import Organization from '@/app/lib/models/Organization';

/**
 * GET /api/v1/organizations
 * Fetch all organizations
 */
export async function GET() {
  try {
    await connectMasterDb();
    const organizations = await Organization.find({}).select('uuid name slug');
    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

/**
 * POST /api/v1/organizations
 * Create a new organization (minimal: name + slug only)
 */
export async function POST(request: NextRequest) {
  try {
    await connectMasterDb();

    const body = await request.json();
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const existingOrg = await Organization.findOne({ slug: body.slug });
    if (existingOrg) {
      return NextResponse.json(
        { error: 'Slug already in use' },
        { status: 409 }
      );
    }

    // Auto-generate databaseName from slug
    const databaseName = `narimato_${body.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const newOrg = await Organization.create({
      name: body.name,
      slug: body.slug,
      databaseName
    });

    return NextResponse.json({ organization: newOrg.toObject() });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
