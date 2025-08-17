import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '@/app/lib/utils/db';
import Organization from '@/app/lib/models/Organization';

// Simple in-memory cache for organization data
// Cache for 5 minutes to balance performance and data freshness
const organizationCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/organization/[slug]
 * Get a specific organization by slug with caching
 * This is optimized for URL-based organization detection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Organization slug is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `org:${slug.toLowerCase()}`;
    const cached = organizationCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`📋 Organization cache hit for slug: ${slug}`);
      return NextResponse.json({
        success: true,
        organization: cached.data,
        cached: true
      });
    }

    console.log(`📋 Organization cache miss for slug: ${slug}, fetching from DB`);
    
    // Connect to master database
    const masterConnection = await connectMasterDb();
    const OrganizationModel = masterConnection.model('Organization', Organization.schema);
    
    // Find organization by slug
    const organization = await OrganizationModel.findOne({
      slug: slug.toLowerCase(),
      isActive: true
    });
    
    if (!organization) {
      return NextResponse.json(
        { success: false, error: `Organization '${slug}' not found or inactive` },
        { status: 404 }
      );
    }

    // Transform to expected format
    const orgData = {
      OrganizationUUID: organization.uuid,
      OrganizationName: organization.displayName,
      OrganizationSlug: organization.slug,
      OrganizationDescription: organization.description,
      databaseName: organization.databaseName,
      subdomain: organization.subdomain,
      theme: organization.theme,
      branding: organization.branding,
      permissions: organization.permissions,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt
    };

    // Cache the result
    organizationCache.set(cacheKey, {
      data: orgData,
      timestamp: now
    });

    console.log(`📋 Organization fetched and cached: ${organization.displayName} (${organization.uuid})`);

    return NextResponse.json({
      success: true,
      organization: orgData,
      cached: false
    });
    
  } catch (error) {
    console.error('❌ Error fetching organization by slug:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch organization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Clear cache for specific organization
 * This can be called when organization data is updated
 */
export function clearOrganizationCache(slug: string) {
  const cacheKey = `org:${slug.toLowerCase()}`;
  organizationCache.delete(cacheKey);
  console.log(`📋 Organization cache cleared for: ${slug}`);
}

/**
 * Clear all organization cache
 * This can be called during system maintenance
 */
export function clearAllOrganizationCache() {
  organizationCache.clear();
  console.log('📋 All organization cache cleared');
}
