'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrganization } from '../../components/OrganizationProvider';
import CompletedPage from '../../completed/page';

export default function OrganizationCompletedPage() {
  const params = useParams();
  const router = useRouter();
  const { switchToOrganizationBySlug, currentOrganization, isLoading } = useOrganization();
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const slug = params?.slug as string;

  useEffect(() => {
    const selectOrganization = async () => {
      if (!slug) {
        setOrgError('Invalid organization URL');
        setOrgLoading(false);
        return;
      }

      try {
        setOrgLoading(true);
        const success = await switchToOrganizationBySlug(slug);
        
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
  }, [slug, switchToOrganizationBySlug]);

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

  return <CompletedPage />;
}
