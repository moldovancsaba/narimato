'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import GlobalNavigation from './GlobalNavigation';
import OrganizationNavigation from './OrganizationNavigation';

/**
 * Navigation controller that decides which navigation to show
 * 
 * - Shows OrganizationNavigation for organization-specific pages (e.g., /moldovan, /moldovan/*)
 * - Shows GlobalNavigation for all other pages
 */
const NavigationController = React.memo(function NavigationController() {
  const pathname = usePathname();

  // Check if we're on an organization-specific page
  // Organization pages match pattern: /[slug] or /[slug]/anything
  // Exclude core app routes like /swipe, /vote, /cards, etc.
  const coreRoutes = [
    '/swipe',
    '/vote', 
    '/completed',
    '/ranks',
    '/cards',
    '/card-editor',
    '/organization-editor'
  ];

  // Check if current path is a core route or starts with a core route
  const isCoreRoute = coreRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if it's the home page
  const isHomePage = pathname === '/';

  // Check if the path is an organization-specific route
  // Organization routes: /organization/[slug]/* or /[slug] (when not a core route)
  const isOrganizationRoute = (() => {
    // Check for /organization/[slug] pattern
    if (pathname.startsWith('/organization/')) {
      return true;
    }
    
    // Check for direct slug pattern: /[slug] or /[slug]/anything
    // But exclude core routes
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 1 && !isCoreRoute && !isHomePage) {
      const slug = pathSegments[0];
      
      // If it's just a slug or slug with known org sub-pages
      if (pathSegments.length === 1 || 
          (pathSegments.length === 2 && ['completed', 'rankings', 'play', 'swipe', 'cards', 'card-editor', 'ranks'].includes(pathSegments[1]))) {
        return true;
      }
    }
    
    return false;
  })();

  // If it's a core route or home page, show global navigation
  if (isCoreRoute || isHomePage) {
    return <GlobalNavigation />;
  }
  
  // If it's an organization route, show organization navigation
  if (isOrganizationRoute) {
    return <OrganizationNavigation />;
  }

  // Default to global navigation
  return <GlobalNavigation />;
});

export default NavigationController;
