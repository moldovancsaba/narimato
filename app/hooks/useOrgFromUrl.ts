'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOrganizationTheme } from './useOrganizationTheme';

interface Organization {
  OrganizationUUID: string;
  OrganizationName: string;
  OrganizationSlug: string;
  OrganizationDescription?: string;
  databaseName: string;
  subdomain?: string;
  theme?: any;
  branding?: any;
  permissions?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UseOrgFromUrlResult {
  organization: Organization | null;
  isLoading: boolean;
  error: string | null;
  slug: string | null;
}

/**
 * Lightweight organization hook for URL-based pages
 * 
 * This hook:
 * 1. Extracts organization slug from URL path
 * 2. Fetches ONLY that organization (not all organizations)
 * 3. Applies organization theme
 * 4. Avoids the heavy OrganizationProvider overhead
 * 
 * Use this for pages like:
 * - /organization/{slug}/cards
 * - /organization/{slug}/ranks
 * - /organization/{slug}/play
 */
// Global cache for organization data to prevent duplicate fetches
const orgCache = new Map<string, { data: Organization; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useOrgFromUrl(): UseOrgFromUrlResult {
  const pathname = usePathname();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [fetchingRef, setFetchingRef] = useState<string | null>(null); // Track ongoing fetches

  // Apply theme when organization changes
  useOrganizationTheme(organization?.theme);

  useEffect(() => {
    // Extract organization slug from URL
    const pathMatch = pathname.match(/^\/organization\/([^\/]+)/);
    const extractedSlug = pathMatch ? pathMatch[1] : null;
    
    setSlug(extractedSlug);
    
    if (!extractedSlug) {
      setError('No organization slug found in URL');
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = `org:${extractedSlug}`;
    const cached = orgCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`💾 Organization cache hit for slug: ${extractedSlug}`);
      setOrganization(cached.data);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Prevent duplicate fetches for the same slug
    if (fetchingRef === extractedSlug) {
      console.log(`🚫 Already fetching organization: ${extractedSlug}`);
      return;
    }

    console.log(`🔗 Extracted organization slug from URL: ${extractedSlug}`);
    
    // Fetch the specific organization
    fetchOrganization(extractedSlug);
  }, [pathname, fetchingRef]);

  const fetchOrganization = async (orgSlug: string) => {
    const cacheKey = `org:${orgSlug}`;
    
    try {
      setIsLoading(true);
      setError(null);
      setFetchingRef(orgSlug); // Mark as being fetched
      
      console.log(`📋 Fetching organization: ${orgSlug}`);
      
      const response = await fetch(`/api/v1/organization/${orgSlug}`);
      const data = await response.json();
      
      if (data.success) {
        // Cache the organization data
        orgCache.set(cacheKey, {
          data: data.organization,
          timestamp: Date.now()
        });
        
        setOrganization(data.organization);
        console.log(`✅ Organization loaded and cached: ${data.organization.OrganizationName} ${data.cached ? '(server-cached)' : '(fresh)'}`);
      } else {
        setError(data.error || 'Failed to load organization');
        console.error(`❌ Failed to load organization: ${data.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setError(errorMessage);
      console.error(`❌ Network error loading organization: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setFetchingRef(null); // Clear fetch tracking
    }
  };

  return {
    organization,
    isLoading,
    error,
    slug
  };
}
