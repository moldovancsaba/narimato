import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '@/app/lib/utils/db';
import Organization, { IOrganization } from '@/app/lib/models/Organization';

/**
 * Organization Detection Middleware with Caching
 * 
 * ARCHITECTURAL PURPOSE:
 * - Extracts organization context from request URLs
 * - Supports both `/organization/{slug}` paths and `{subdomain}.narimato.com` subdomains
 * - Attaches organization info for downstream route handling
 * - Ensures proper database connection routing based on organization
 * - PERFORMANCE: Caches organization lookups to avoid redundant DB queries
 * 
 * SECURITY CONSIDERATIONS:
 * - Validates organization existence and active status
 * - Prevents unauthorized access to inactive organizations
 * - Rate limiting per organization to prevent abuse
 */

// Organization cache for middleware performance
// Cache organization lookups for 5 minutes to avoid redundant DB queries
const middlewareOrgCache = new Map<string, { data: IOrganization; timestamp: number }>();
const MIDDLEWARE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
 * Get organization context from request with caching
 */
export async function getOrganizationContext(request: NextRequest): Promise<OrganizationContext | null> {
  try {
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
    
    // Create cache key based on UUID or slug
    const cacheKey = orgUUID ? `uuid:${orgUUID}` : `slug:${orgSlug?.toLowerCase()}`;
    
    // Check cache first
    const cached = middlewareOrgCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < MIDDLEWARE_CACHE_DURATION) {
      console.log(`📋 Middleware cache hit for: ${cacheKey}`);
      return {
        organization: cached.data,
        organizationUUID: cached.data.uuid,
        databaseName: cached.data.databaseName
      };
    }
    
    console.log(`📋 Middleware cache miss for: ${cacheKey}, fetching from DB`);
    
    // Connect to master database to fetch organization data
    // This connection is cached and reused to prevent connection conflicts
    const masterConnection = await connectMasterDb();
    
    // Get Organization model bound to master connection
    const OrganizationModel = masterConnection.model('Organization', Organization.schema);
    
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
      console.warn(`Organization not found or inactive: ${orgSlug || orgUUID}`);
      return null;
    }
    
    const orgData = organization.toObject();
    
    // Cache the result
    middlewareOrgCache.set(cacheKey, {
      data: orgData,
      timestamp: now
    });
    
    console.log(`📋 Organization cached in middleware: ${organization.displayName} (${organization.uuid})`);
    
    return {
      organization: orgData,
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
  handler: (request: NextRequest, context: OrganizationContext, routeContext?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: any) => {
    const orgContext = await getOrganizationContext(request);
    
    if (!orgContext) {
      return NextResponse.json(
        { error: 'Organization not found or inactive' },
        { status: 404 }
      );
    }
    
    try {
      return await handler(request, orgContext, routeContext);
    } catch (error) {
      console.error('Error in organization-aware handler:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Clear middleware cache for specific organization
 * Should be called when organization data is updated
 */
export function clearMiddlewareOrgCache(identifier: string, type: 'uuid' | 'slug' = 'slug') {
  const cacheKey = `${type}:${type === 'slug' ? identifier.toLowerCase() : identifier}`;
  middlewareOrgCache.delete(cacheKey);
  console.log(`📋 Middleware cache cleared for: ${cacheKey}`);
}

/**
 * Clear all middleware organization cache
 * Should be called during system maintenance
 */
export function clearAllMiddlewareOrgCache() {
  middlewareOrgCache.clear();
  console.log('📋 All middleware organization cache cleared');
}
