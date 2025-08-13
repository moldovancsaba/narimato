'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrganization } from '../components/OrganizationProvider';
import OrganizationMainPage from '../components/OrganizationMainPage';

/**
 * Organization-specific main page accessed via /[slug]
 * 
 * ARCHITECTURAL PURPOSE:
 * - Provides organization-specific landing page via slug URL
 * - Automatically selects the organization based on slug parameter
 * - Shows limited functionality: choose deck -> SWIPE/VOTE, completed page, global rankings
 * - Applies organization-specific theming and branding
 * 
 * SECURITY CONSIDERATIONS:
 * - Only loads active organizations
 * - Validates slug format to prevent injection
 * - Organization selection happens client-side after validation
 */

export default function OrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const { switchToOrganizationBySlug, currentOrganization, isLoading, isOrgDataLoaded } = useOrganization();
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const slug = params?.slug as string;

  useEffect(() => {
    console.log(`[OrganizationPage] useEffect triggered`);
    console.log(`[OrganizationPage] slug: ${slug}`);
    console.log(`[OrganizationPage] isOrgDataLoaded: ${isOrgDataLoaded}`);
    console.log(`[OrganizationPage] orgLoading: ${orgLoading}`);
    console.log(`[OrganizationPage] currentOrganization: ${currentOrganization ? currentOrganization.OrganizationName : 'null'}`);
    
    const selectOrganization = async () => {
      if (!slug) {
        console.log(`[OrganizationPage] No slug provided`);
        setOrgError('Invalid organization URL');
        setOrgLoading(false);
        return;
      }

      // Wait for organization data to be loaded
      if (!isOrgDataLoaded) {
        console.log(`[OrganizationPage] Organization data not loaded yet, waiting...`);
        return; // Don't proceed until data is loaded
      }

      try {
        console.log(`[OrganizationPage] Starting organization selection for slug: ${slug}`);
        setOrgLoading(true);
        const success = await switchToOrganizationBySlug(slug);
        console.log(`[OrganizationPage] Organization selection result: ${success}`);
        
        if (!success) {
          setOrgError('Organization not found or inactive');
        }
      } catch (error) {
        console.error('Failed to select organization:', error);
        setOrgError('Failed to load organization');
      } finally {
        setOrgLoading(false);
      }
    };

    selectOrganization();
  }, [slug, switchToOrganizationBySlug, isOrgDataLoaded]);

  // Show loading state
  if (isLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">
          Loading organization...
        </span>
      </div>
    );
  }

  // Show error if organization not found
  if (orgError || !currentOrganization) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-bold mb-2">Organization Not Found</h1>
          <p className="text-gray-500 mb-6">
            {orgError || 'The organization you\'re looking for doesn\'t exist or is inactive.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary px-6 py-3"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Render organization-specific main page
  return (
    <OrganizationMainPage 
      organization={currentOrganization}
      isOrgSpecific={true}
    />
  );
}
