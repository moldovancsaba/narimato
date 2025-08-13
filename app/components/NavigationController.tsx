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

  // If it's a core route or home page, show global navigation
  if (isCoreRoute || isHomePage) {
    return <GlobalNavigation />;
  }

  // Check if the path looks like an organization page
  // Organization pages: /[slug] or /[slug]/completed or /[slug]/rankings
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length >= 1) {
    const slug = pathSegments[0];
    
    // If it's just a slug or slug with known org sub-pages
    if (pathSegments.length === 1 || 
        (pathSegments.length === 2 && ['completed', 'rankings'].includes(pathSegments[1]))) {
      return <OrganizationNavigation />;
    }
  }

  // Default to global navigation
  return <GlobalNavigation />;
});

export default NavigationController;
