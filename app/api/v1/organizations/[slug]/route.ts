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

    const organization = await Organization.findOne({ slug }).select('uuid name slug');
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization: organization.toObject() });
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
      const existing = await Organization.findOne({ slug: body.slug });
      if (existing) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      }
    }

    const organization = await Organization.findOneAndUpdate(
      { slug },
      { name: body.name, slug: body.slug },
      { new: true }
    ).select('uuid name slug');

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization: organization.toObject() });
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

    const organization = await Organization.findOneAndDelete({ slug });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
