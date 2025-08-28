import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '../../../../lib/utils/db';
import Organization from '../../../../lib/models/Organization';

/**
 * GET /api/v1/organizations/[slug]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectMasterDb();
    const { slug } = await params;

    const organization = await Organization.findOne({ slug, isActive: true })
      .select('uuid displayName slug description createdAt')
      .lean()
      .maxTimeMS(30000); // 30 second timeout for operations
      
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/v1/organizations/[slug]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectMasterDb();
    const { slug } = await params;
    const body = await request.json();

    if (!body.name || !body.slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check if new slug conflicts with existing org (except current one)
    if (body.slug !== slug) {
      const existing = await Organization.findOne({ slug: body.slug, isActive: true });
      if (existing) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    const organization = await Organization.findOneAndUpdate(
      { slug, isActive: true },
      { 
        displayName: body.name, 
        slug: body.slug,
        description: body.description || ''
      },
      { new: true }
    ).select('uuid displayName slug description createdAt');

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/organizations/[slug]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectMasterDb();
    const { slug } = await params;

    const organization = await Organization.findOneAndUpdate(
      { slug, isActive: true },
      { isActive: false },
      { new: true }
    );
    
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
