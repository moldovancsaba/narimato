'use client';

import React, { useMemo } from 'react';
import { IOrganizationPermissions, IFeaturePermissions } from '../lib/models/Organization';

export type UserRole = 'viewer' | 'editor' | 'admin' | 'owner';

export interface PermissionContext {
  hasPermission: (feature: keyof IFeaturePermissions) => boolean;
  userRole: UserRole;
  permissions: IFeaturePermissions;
  canAccess: (features: (keyof IFeaturePermissions)[]) => boolean;
  requiresPermission: (feature: keyof IFeaturePermissions) => boolean;
}

/**
 * Custom hook for managing organization-specific permissions
 * 
 * This hook provides a clean interface for checking user permissions
 * within an organization context, supporting role-based access control
 * and feature-specific permission checking.
 */
export function useOrganizationPermissions(
  organizationPermissions: IOrganizationPermissions | null | undefined,
  userRole?: UserRole
): PermissionContext {
  
  const effectiveRole = userRole || organizationPermissions?.defaultRole || 'viewer';
  
  const permissions = useMemo(() => {
    if (!organizationPermissions) {
      // Default restrictive permissions when no organization permissions are set
      return {
        canCreateCards: false,
        canEditCards: false,
        canDeleteCards: false,
        canManageUsers: false,
        canViewAnalytics: false,
        canExportData: false,
        canManageSettings: false,
        canManageThemes: false
      };
    }

    // Get role-specific permissions, fallback to default feature permissions
    const rolePermissions = organizationPermissions.rolePermissions?.[effectiveRole];
    if (rolePermissions) {
      return {
        canCreateCards: rolePermissions.canCreateCards,
        canEditCards: rolePermissions.canEditCards,
        canDeleteCards: rolePermissions.canDeleteCards,
        canManageUsers: rolePermissions.canManageUsers,
        canViewAnalytics: rolePermissions.canViewAnalytics,
        canExportData: rolePermissions.canExportData,
        canManageSettings: rolePermissions.canManageSettings,
        canManageThemes: rolePermissions.canManageThemes
      };
    }

    // Fallback to organization-wide feature permissions
    return organizationPermissions.features || {
      canCreateCards: false,
      canEditCards: false,
      canDeleteCards: false,
      canManageUsers: false,
      canViewAnalytics: false,
      canExportData: false,
      canManageSettings: false,
      canManageThemes: false
    };
  }, [organizationPermissions, effectiveRole]);

  const hasPermission = (feature: keyof IFeaturePermissions): boolean => {
    return permissions[feature] || false;
  };

  const canAccess = (features: (keyof IFeaturePermissions)[]): boolean => {
    return features.some(feature => hasPermission(feature));
  };

  const requiresPermission = (feature: keyof IFeaturePermissions): boolean => {
    if (!hasPermission(feature)) {
      console.warn(`Access denied: Missing permission for ${feature}`);
      return false;
    }
    return true;
  };

  return {
    hasPermission,
    userRole: effectiveRole,
    permissions,
    canAccess,
    requiresPermission
  };
}

/**
 * Permission-aware component wrapper
 * 
 * Utility function to conditionally render components based on permissions
 */
export function withPermission<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  requiredPermission: keyof IFeaturePermissions,
  fallback?: React.ComponentType<T> | null
) {
  return function PermissionWrapper(props: T) {
    const { hasPermission } = useOrganizationPermissions(
      // Note: This would need to be passed down or accessed via context
      null, // organizationPermissions - to be replaced with actual context
      undefined // userRole - to be replaced with actual user role
    );

    if (!hasPermission(requiredPermission)) {
      return fallback ? React.createElement(fallback, props) : null;
    }

    return React.createElement(Component, props);
  };
}

/**
 * Role hierarchy helper
 * 
 * Determines if a role has at least the same level as required role
 */
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(role: UserRole): IFeaturePermissions {
  const roleDefaults: Record<UserRole, IFeaturePermissions> = {
    viewer: {
      canCreateCards: false,
      canEditCards: false,
      canDeleteCards: false,
      canManageUsers: false,
      canViewAnalytics: false,
      canExportData: false,
      canManageSettings: false,
      canManageThemes: false
    },
    editor: {
      canCreateCards: true,
      canEditCards: true,
      canDeleteCards: false,
      canManageUsers: false,
      canViewAnalytics: false,
      canExportData: false,
      canManageSettings: false,
      canManageThemes: false
    },
    admin: {
      canCreateCards: true,
      canEditCards: true,
      canDeleteCards: true,
      canManageUsers: true,
      canViewAnalytics: true,
      canExportData: true,
      canManageSettings: true,
      canManageThemes: true
    },
    owner: {
      canCreateCards: true,
      canEditCards: true,
      canDeleteCards: true,
      canManageUsers: true,
      canViewAnalytics: true,
      canExportData: true,
      canManageSettings: true,
      canManageThemes: true
    }
  };

  return roleDefaults[role];
}
