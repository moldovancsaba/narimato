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
  refreshOrganizations: () => Promise<void>;
  isLoading: boolean;
  
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
  
  // Get permission context
  const permissions = useOrganizationPermissions(currentOrganization?.permissions, userRole);

  // Load organizations and current selection on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
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
              setOrganizations([defaultData.organization]);
              setCurrentOrganization(defaultData.organization);
              localStorage.setItem('selectedOrganization', defaultData.organization.OrganizationSlug);
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
        if (savedOrgSlug) {
          const savedOrg = mappedOrganizations.find((org: Organization) => org.OrganizationSlug === savedOrgSlug);
          if (savedOrg && savedOrg.isActive) {
            setCurrentOrganization(savedOrg);
          }
        }
        
        // If no saved organization or it's invalid, select the first active one
        if (!currentOrganization) {
          const firstActiveOrg = mappedOrganizations.find((org: Organization) => org.isActive);
          if (firstActiveOrg) {
            setCurrentOrganization(firstActiveOrg);
            localStorage.setItem('selectedOrganization', firstActiveOrg.OrganizationSlug);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      
      // If no organizations are available, get or create the default one
      try {
        const defaultResponse = await fetch('/api/v1/organizations/default');
        const defaultData = await defaultResponse.json();
        
        if (defaultData.success) {
          setOrganizations([defaultData.organization]);
          setCurrentOrganization(defaultData.organization);
        }
      } catch (defaultError) {
        console.error('Failed to get/create default organization:', defaultError);
      }
    } finally {
      setIsLoading(false);
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
    refreshOrganizations,
    isLoading,
    
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
