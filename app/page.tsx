'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from './components/PageLayout';
import LoadingSpinner from './components/LoadingSpinner';

interface Organization {
  OrganizationUUID: string;
  OrganizationName: string;
  displayName: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  theme?: {
    primaryColor?: string;
    logo?: string;
    favicon?: string;
  };
}

export default function OrganizationSelectorPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FUNCTIONAL: Fetch all available organizations for selection
  // STRATEGIC: Enable multi-tenant architecture by showing organization choice upfront
  useEffect(() => {
    // Add a small delay on first load to prevent hydration mismatch
    const timer = setTimeout(() => {
      fetchOrganizations();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      console.log('🏢 Fetching available organizations...');
      
      const response = await fetch('/api/v1/admin/organizations');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Organizations fetched:', data.organizations?.length || 0);
      
      // Filter to active organizations only and map field names correctly
      const activeOrgs = (data.organizations || []).filter((org: any) => org.isActive).map((org: any) => {
        // Generate a fallback slug if OrganizationSlug is missing or undefined
        const slug = org.OrganizationSlug || 
                    org.slug || 
                    org.OrganizationName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 
                    `org-${org.OrganizationUUID?.substring(0, 8) || 'unknown'}`;
        
        return {
          OrganizationUUID: org.OrganizationUUID,
          OrganizationName: org.OrganizationName,
          displayName: org.OrganizationName, // Use OrganizationName as displayName
          slug: slug, // Use computed slug with fallback
          isActive: org.isActive,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          description: org.OrganizationDescription,
          theme: org.theme
        };
      });
      
      console.log('🗺️ Mapped organizations:', activeOrgs.map(org => ({ name: org.OrganizationName, slug: org.slug })));
      setOrganizations(activeOrgs);
      
    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      setError(`Failed to load organizations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // FUNCTIONAL: Handle organization selection and navigation
  // STRATEGIC: Redirect users to their organization's main dashboard
  const handleOrganizationSelect = (organization: Organization) => {
    console.log(`🏢 Organization selected: ${organization.OrganizationName} (slug: '${organization.slug}')`);
    console.log('🔍 Full organization object:', organization);
    
    if (!organization.slug || organization.slug === 'undefined') {
      console.error('❌ Organization slug is undefined or invalid!', organization);
      setError(`Organization slug is missing for ${organization.OrganizationName}. Please contact administrator.`);
      return;
    }
    
    const targetUrl = `/organization/${organization.slug}`;
    console.log(`🎯 Navigating to: ${targetUrl}`);
    router.push(targetUrl);
  };

  // Show loading state
  if (loading) {
    return (
      <PageLayout title="Organization Selector">
        <div className="flex items-center justify-center page-height">
          <LoadingSpinner size="lg" message="Loading organizations..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Choose Your Organization">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Welcome to 几卂尺丨爪卂ㄒㄖ</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Create your personal rankings through simple swipes and votes. 
            Choose your organization to get started.
          </p>
        </div>

        {error && (
          <div className="status-error p-4 mb-6 rounded-lg">
            {error}
          </div>
        )}

        {organizations.length === 0 && !error ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold mb-2">No Organizations Available</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              There are currently no active organizations. Please contact your administrator.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div
                key={org.OrganizationUUID}
                onClick={() => handleOrganizationSelect(org)}
                className="group cursor-pointer bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-500 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center mb-4">
                  {org.theme?.logo ? (
                    <img
                      src={org.theme.logo}
                      alt={`${org.OrganizationName} logo`}
                      className="w-12 h-12 rounded-lg mr-4 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg mr-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {org.OrganizationName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {org.displayName || org.OrganizationName}
                    </h3>
                    <p className="text-sm text-gray-500">/{org.slug}</p>
                  </div>
                </div>
                
                {org.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {org.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Active Organization</span>
                  <span className="text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                    Enter →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Access */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 mb-2">Administrative Access</p>
          <button
            onClick={() => router.push('/organization-editor')}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            🔧 Organization Management
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-400">
          <p>Multi-tenant ranking system • No registration required</p>
        </div>
      </div>
    </PageLayout>
  );
}
