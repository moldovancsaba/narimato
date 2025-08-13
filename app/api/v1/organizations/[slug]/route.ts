import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '../../../../lib/utils/db';
import Organization from '../../../../lib/models/Organization';

/**
 * GET /api/v1/organizations/[slug] - Fetch organization by slug
 * 
 * ARCHITECTURAL PURPOSE:
 * - Provides organization data lookup by human-readable slug
 * - Enables organization-specific URL routing and theming
 * - Supports public organization pages and branding
 * 
 * SECURITY CONSIDERATIONS:
 * - Only returns active organizations
 * - Validates slug format to prevent injection
 * - Sanitizes output to prevent data leakage
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Connect to MongoDB
    await connectMasterDb();

    const { slug } = await params;

    // Basic slug validation
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid slug format. Slug must contain only lowercase letters, numbers, and hyphens.' 
        },
        { status: 400 }
      );
    }

    // Find organization by slug
    const organization = await Organization.findOne({ 
      slug: slug.toLowerCase(),
      isActive: true 
    }).select('-__v').lean();

    if (!organization) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization not found or inactive' 
        },
        { status: 404 }
      );
    }

    // Map to UUID-first format for frontend consistency
    const mappedOrganization = {
      OrganizationUUID: organization.uuid,
      OrganizationName: organization.displayName,
      OrganizationSlug: organization.slug,
      OrganizationDescription: organization.description,
      databaseName: organization.databaseName,
      subdomain: organization.subdomain,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt || organization.createdAt,
      theme: organization.theme,
      branding: organization.branding,
      permissions: organization.permissions
    };

    return NextResponse.json({
      success: true,
      organization: mappedOrganization
    });

  } catch (error) {
    console.error('Error fetching organization by slug:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
