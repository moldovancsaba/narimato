import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '@/app/lib/utils/db';
import Organization, { IOrganization } from '@/app/lib/models/Organization';

/**
 * Organization Detection Middleware
 * 
 * ARCHITECTURAL PURPOSE:
 * - Extracts organization context from request URLs
 * - Supports both `/organization/{slug}` paths and `{subdomain}.narimato.com` subdomains
 * - Attaches organization info for downstream route handling
 * - Ensures proper database connection routing based on organization
 * 
 * SECURITY CONSIDERATIONS:
 * - Validates organization existence and active status
 * - Prevents unauthorized access to inactive organizations
 * - Rate limiting per organization to prevent abuse
 */

export interface OrganizationContext {
  organization: IOrganization;
  organizationUUID: string;
  databaseName: string;
}

/**
 * Extract organization slug from URL path
 * Supports: /organization/{slug}/...
 */
function extractOrgSlugFromPath(pathname: string): string | null {
  const pathMatch = pathname.match(/^\/organization\/([^\/]+)/);
  return pathMatch ? pathMatch[1] : null;
}

/**
 * Extract organization subdomain from hostname  
 * Supports: {subdomain}.narimato.com
 */
function extractOrgSlugFromSubdomain(hostname: string): string | null {
  // Check if it's a subdomain of narimato.com
  const subdomainMatch = hostname.match(/^([^.]+)\.narimato\.com$/);
  return subdomainMatch ? subdomainMatch[1] : null;
}

/**
 * Get organization context from request
 */
export async function getOrganizationContext(request: NextRequest): Promise<OrganizationContext | null> {
  try {
    // Connect to master database to fetch organization data
    // This connection is cached and reused to prevent connection conflicts
    const masterConnection = await connectMasterDb();
    
    // Get Organization model bound to master connection
    const OrganizationModel = masterConnection.model('Organization', Organization.schema);
    
    const url = new URL(request.url);
    let orgSlug: string | null = null;
    let orgUUID: string | null = null;
    
    // Try to extract organization UUID from header
    const headerUUID = request.headers.get('X-Organization-UUID');
    if (headerUUID) {
      orgUUID = headerUUID;
      console.log('📋 Organization UUID from header:', orgUUID);
    }
    
    // Try to extract organization from slug header
    const headerSlug = request.headers.get('X-Organization-Slug');
    if (!orgUUID && headerSlug) {
      orgSlug = headerSlug;
      console.log('📋 Organization slug from header:', orgSlug);
    }
    
    // Try to extract organization from path if not in header
    if (!orgSlug) {
      orgSlug = extractOrgSlugFromPath(url.pathname);
    }
    
    // If not found in path, try subdomain
    if (!orgSlug) {
      orgSlug = extractOrgSlugFromSubdomain(url.hostname);
    }
    
    // No fallback - organization context must be provided
    if (!orgUUID && !orgSlug) {
      console.warn('❌ No organization context found in request');
      return null;
    }
    
    // Lookup organization by UUID first, then fallback to slug
    let organization;
    if (orgUUID) {
      organization = await OrganizationModel.findOne({ 
        uuid: orgUUID,
        isActive: true 
      });
    } else if (orgSlug) {
      organization = await OrganizationModel.findOne({ 
        slug: orgSlug.toLowerCase(),
        isActive: true 
      });
    }
    
    if (!organization) {
      console.warn(`Organization not found or inactive: ${orgSlug}`);
      return null;
    }
    
    return {
      organization: organization.toObject(),
      organizationUUID: organization.uuid,
      databaseName: organization.databaseName
    };
    
  } catch (error) {
    console.error('Error getting organization context:', error);
    
    // NO FALLBACK - Database connection issues should be resolved, not masked
    console.error('❌ MongoDB connection failed - no fallback organization will be provided');
    console.error('Please ensure MongoDB is accessible and the organization exists in the database');
    
    return null;
  }
}

/**
 * Middleware to attach organization context to API requests
 * This is used for API routes that need organization-specific database connections
 */
export async function withOrganizationContext(
  request: NextRequest,
  handler: (request: NextRequest, context: OrganizationContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const orgContext = await getOrganizationContext(request);
  
  if (!orgContext) {
    return NextResponse.json(
      { error: 'Organization not found or inactive' },
      { status: 404 }
    );
  }
  
  try {
    return await handler(request, orgContext);
  } catch (error) {
    console.error('Error in organization-aware handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if request is organization-scoped
 * Returns true if the request contains organization context
 */
export function isOrganizationScoped(request: NextRequest): boolean {
  const url = new URL(request.url);
  
  // Check for organization path
  if (extractOrgSlugFromPath(url.pathname)) {
    return true;
  }
  
  // Check for organization subdomain
  if (extractOrgSlugFromSubdomain(url.hostname)) {
    return true;
  }
  
  return false;
}

/**
 * Redirect organization URLs to proper format
 * Ensures consistent URL structure across the application
 */
export function normalizeOrganizationUrl(request: NextRequest): NextResponse | null {
  const url = new URL(request.url);
  
  // If it's a subdomain, redirect to path-based URL for consistency
  const subdomainSlug = extractOrgSlugFromSubdomain(url.hostname);
  if (subdomainSlug) {
    const newUrl = new URL(request.url);
    newUrl.hostname = 'narimato.com'; // Remove subdomain
    newUrl.pathname = `/organization/${subdomainSlug}${url.pathname}`;
    
    return NextResponse.redirect(newUrl.toString());
  }
  
  return null; // No redirect needed
}

/**
 * Organization-aware route wrapper for API endpoints
 * Automatically handles organization detection and database connection routing
 */
export function createOrgAwareRoute(
  handler: (request: NextRequest, context: OrganizationContext) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    return withOrganizationContext(request, handler);
  };
}
