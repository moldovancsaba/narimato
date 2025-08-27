'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useOrganizationTheme, ThemeConfig } from '../hooks/useOrganizationTheme';
import { useOrganizationPermissions, UserRole, PermissionContext } from '../hooks/useOrganizationPermissions';
import { IOrganization, IOrganizationTheme, IOrganizationBranding, IOrganizationPermissions } from '../lib/models/Organization';

interface Organization extends IOrganization {
  OrganizationUUID: string;
  OrganizationName: string;
  OrganizationSlug: string;
  OrganizationDescription?: string;
  databaseName: string;
  subdomain?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationContextType {
  // Core organization data
  currentOrganization: Organization | null;
  organizations: Organization[];
  setCurrentOrganization: (org: Organization | null) => void;
  switchToOrganization: (organizationUUID: string) => Promise<boolean>;
  switchToOrganizationBySlug: (slug: string) => Promise<boolean>;
  refreshOrganizations: () => Promise<void>;
  isOrgDataLoaded: boolean;
  
  // Theme functionality
  theme: ThemeConfig | null;
  updateTheme: (theme: Partial<IOrganizationTheme>) => Promise<boolean>;
  resetTheme: () => Promise<boolean>;
  
  // Branding functionality
  branding: IOrganizationBranding | null;
  updateBranding: (branding: Partial<IOrganizationBranding>) => Promise<boolean>;
  
  // Permission functionality
  permissions: PermissionContext;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  updatePermissions: (permissions: Partial<IOrganizationPermissions>) => Promise<boolean>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>('viewer');

  // Extract theme configuration from current organization
  const theme = currentOrganization?.theme || null;
  const branding = currentOrganization?.branding || null;
  
  // Apply theme using the custom hook
  useOrganizationTheme(theme);
  
  const [isOrgDataLoaded, setIsOrgDataLoaded] = useState(false);

  // Get permission context
  const permissions = useOrganizationPermissions(currentOrganization?.permissions, userRole);

  // Load organizations and current selection on mount with caching
  useEffect(() => {
    const cached = sessionStorage.getItem('organizations-cache');
    const cacheTime = sessionStorage.getItem('organizations-cache-time');
    
    // Use cache if it's less than 5 minutes old
    if (cached && cacheTime && Date.now() - parseInt(cacheTime) < 5 * 60 * 1000) {
      try {
        const cachedData = JSON.parse(cached);
        setOrganizations(cachedData.organizations);
        if (cachedData.currentOrganization) {
          setCurrentOrganization(cachedData.currentOrganization);
        }
        setIsOrgDataLoaded(true);
        setIsLoading(false);
        
        // Still load fresh data in background
        setTimeout(() => loadOrganizations(true), 100);
        return;
      } catch (e) {
        console.warn('Failed to parse cached organizations:', e);
      }
    }
    
    loadOrganizations();
  }, []);

  const loadOrganizations = async (backgroundUpdate = false) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/admin/organizations');
      const data = await response.json();
      
      if (data.success) {
        // If no organizations are available, get or create the default one
        if (!data.organizations || data.organizations.length === 0) {
          try {
            const defaultResponse = await fetch('/api/v1/organizations/default');
            const defaultData = await defaultResponse.json();
            
            if (defaultData.success) {
              // Map default organization response to expected format
              const mappedDefaultOrg = {
                OrganizationUUID: defaultData.organization.uuid,
                OrganizationName: defaultData.organization.displayName,
                OrganizationSlug: defaultData.organization.slug,
                OrganizationDescription: defaultData.organization.description,
                databaseName: `narimato_org_${defaultData.organization.uuid.replace(/-/g, '_')}`,
                isActive: defaultData.organization.isActive,
                createdAt: defaultData.organization.createdAt,
                updatedAt: defaultData.organization.updatedAt,
                theme: defaultData.organization.theme,
                branding: defaultData.organization.branding,
                permissions: defaultData.organization.permissions
              };
              setOrganizations([mappedDefaultOrg]);
              setCurrentOrganization(mappedDefaultOrg);
              localStorage.setItem('selectedOrganization', mappedDefaultOrg.OrganizationSlug);
              return; // Exit early since we've set up the default org
            }
          } catch (defaultError) {
            console.error('Failed to get/create default organization:', defaultError);
          }
        }
        
        // Map API response format to frontend UUID-first format
        const mappedOrganizations = data.organizations.map((org: any) => ({
          OrganizationUUID: org.OrganizationUUID,
          OrganizationName: org.OrganizationName,
          OrganizationSlug: org.OrganizationSlug,
          OrganizationDescription: org.OrganizationDescription,
          databaseName: org.databaseName,
          subdomain: org.subdomain,
          isActive: org.isActive,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          // Copy theme, branding, and permissions
          theme: org.theme,
          branding: org.branding,
          permissions: org.permissions
        }));
        setOrganizations(mappedOrganizations);
        
        // Try to restore previously selected organization using slug for human readability
        const savedOrgSlug = localStorage.getItem('selectedOrganization');
        let selectedOrg = null;
        
        if (savedOrgSlug) {
          const savedOrg = mappedOrganizations.find((org: Organization) => org.OrganizationSlug === savedOrgSlug);
          if (savedOrg && savedOrg.isActive) {
            selectedOrg = savedOrg;
          }
        }
        
        // If no saved organization or it's invalid, select the first active one
        if (!selectedOrg) {
          const firstActiveOrg = mappedOrganizations.find((org: Organization) => org.isActive);
          if (firstActiveOrg) {
            selectedOrg = firstActiveOrg;
          }
        }
        
        // Set the selected organization
        if (selectedOrg) {
          setCurrentOrganization(selectedOrg);
          localStorage.setItem('selectedOrganization', selectedOrg.OrganizationSlug);
        }
        
        // Cache the data for faster subsequent loads
        const cacheData = {
          organizations: mappedOrganizations,
          currentOrganization: selectedOrg,
          timestamp: Date.now()
        };
        sessionStorage.setItem('organizations-cache', JSON.stringify(cacheData));
        sessionStorage.setItem('organizations-cache-time', Date.now().toString());
        
        setIsOrgDataLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setIsOrgDataLoaded(true); // Set to true even on error so components don't wait forever
      
      // If no organizations are available, get or create the default one
      try {
        const defaultResponse = await fetch('/api/v1/organizations/default');
        const defaultData = await defaultResponse.json();
        
        if (defaultData.success) {
          // Map default organization response to expected format
          const mappedDefaultOrg = {
            OrganizationUUID: defaultData.organization.uuid,
            OrganizationName: defaultData.organization.displayName,
            OrganizationSlug: defaultData.organization.slug,
            OrganizationDescription: defaultData.organization.description,
            databaseName: `narimato_org_${defaultData.organization.uuid.replace(/-/g, '_')}`,
            isActive: defaultData.organization.isActive,
            createdAt: defaultData.organization.createdAt,
            updatedAt: defaultData.organization.updatedAt,
            theme: defaultData.organization.theme,
            branding: defaultData.organization.branding,
            permissions: defaultData.organization.permissions
          };
          setOrganizations([mappedDefaultOrg]);
          setCurrentOrganization(mappedDefaultOrg);
        }
      } catch (defaultError) {
        console.error('Failed to get/create default organization:', defaultError);
      }
    } finally {
      setIsLoading(false);
      setIsOrgDataLoaded(true); // Ensure it's always set to true when loading completes
    }
  };

  const switchToOrganization = async (organizationUUID: string): Promise<boolean> => {
    const org = organizations.find(o => o.OrganizationUUID === organizationUUID && o.isActive);
    if (org) {
      setCurrentOrganization(org);
      // Store slug in localStorage for human readability
      localStorage.setItem('selectedOrganization', org.OrganizationSlug);
      return true;
    }
    return false;
  };

  const switchToOrganizationBySlug = async (slug: string): Promise<boolean> => {
    console.log(`[switchToOrganizationBySlug] Called with slug: ${slug}`);
    console.log(`[switchToOrganizationBySlug] isOrgDataLoaded: ${isOrgDataLoaded}`);
    console.log(`[switchToOrganizationBySlug] organizations count: ${organizations.length}`);
    
    // Wait for organization data to be loaded if it isn't already
    if (!isOrgDataLoaded) {
      console.log(`[switchToOrganizationBySlug] Data not loaded yet, returning false`);
      return false; // Return false, let the calling component wait
    }

    // Find the organization in the loaded list
    const org = organizations.find(o => o.OrganizationSlug === slug && o.isActive);
    console.log(`[switchToOrganizationBySlug] Found organization: ${org ? org.OrganizationName : 'null'}`);
    
    if (org) {
      console.log(`[switchToOrganizationBySlug] Setting current organization to: ${org.OrganizationName}`);
      setCurrentOrganization(org);
      localStorage.setItem('selectedOrganization', org.OrganizationSlug);
      return true;
    }

    // Organization not found
    console.log(`[switchToOrganizationBySlug] Organization '${slug}' not found`);
    return false;
  };

  const refreshOrganizations = async () => {
    await loadOrganizations();
  };

  const updateTheme = async (themeUpdates: Partial<IOrganizationTheme>): Promise<boolean> => {
    if (!currentOrganization) return false;
    
    try {
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationUUID: currentOrganization.OrganizationUUID,
          updates: { theme: { ...currentOrganization.theme, ...themeUpdates } }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentOrganization(data.organization);
        await refreshOrganizations();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update theme:', error);
      return false;
    }
  };

  const resetTheme = async (): Promise<boolean> => {
    if (!currentOrganization) return false;
    
    try {
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationUUID: currentOrganization.OrganizationUUID,
          updates: { theme: {} } // Reset to default theme
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentOrganization(data.organization);
        await refreshOrganizations();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to reset theme:', error);
      return false;
    }
  };

  const updateBranding = async (brandingUpdates: Partial<IOrganizationBranding>): Promise<boolean> => {
    if (!currentOrganization) return false;
    
    try {
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationUUID: currentOrganization.OrganizationUUID,
          updates: { branding: { ...currentOrganization.branding, ...brandingUpdates } }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentOrganization(data.organization);
        await refreshOrganizations();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update branding:', error);
      return false;
    }
  };

  const updatePermissions = async (permissionUpdates: Partial<IOrganizationPermissions>): Promise<boolean> => {
    if (!currentOrganization) return false;
    
    try {
      const response = await fetch('/api/v1/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationUUID: currentOrganization.OrganizationUUID,
          updates: { permissions: { ...currentOrganization.permissions, ...permissionUpdates } }
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentOrganization(data.organization);
        await refreshOrganizations();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update permissions:', error);
      return false;
    }
  };

  const value: OrganizationContextType = {
    // Core organization data
    currentOrganization,
    organizations,
    setCurrentOrganization,
    switchToOrganization,
    switchToOrganizationBySlug,
    refreshOrganizations,
    isLoading,
    isOrgDataLoaded,
    
    // Theme functionality
    theme,
    updateTheme,
    resetTheme,
    
    // Branding functionality
    branding,
    updateBranding,
    
    // Permission functionality
    permissions,
    userRole,
    setUserRole,
    updatePermissions
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}
