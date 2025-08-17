'use client';

import React from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

/**
 * Organization-specific navigation component
 * 
 * Shows only the allowed functionality for organization pages:
 * - Home (deck selection for SWIPE/VOTE)
 * - Global Rankings (view organization rankings)
 * - Completed (share completed rankings)
 * 
 * Navigation is contextual to the current organization slug.
 */
const OrganizationNavigation = React.memo(function OrganizationNavigation() {
  const pathname = usePathname();
  const params = useParams();
  
  // Try to get slug from params or extract from pathname
  let slug = params?.slug as string;
  
  // If no slug in params, try to extract from pathname
  if (!slug) {
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathname.startsWith('/organization/') && pathSegments.length >= 2) {
      slug = pathSegments[1]; // /organization/[slug]
    } else if (pathSegments.length >= 1) {
      slug = pathSegments[0]; // /[slug]
    }
  }

  if (!slug) return null;

  // Determine base path - use /organization/[slug] format for consistency
  const basePath = pathname.startsWith('/organization/') ? `/organization/${slug}` : `/organization/${slug}`;
  
  const navigationItems = [
    { href: `${basePath}`, icon: '🏠', label: 'Home' },
    { href: `${basePath}/play`, icon: '🎮', label: 'Play' },
    { href: `${basePath}/ranks`, icon: '🏆', label: 'Rankings' },
    { href: `${basePath}/cards`, icon: '🎴', label: 'Cards' },
    { href: `${basePath}/card-editor`, icon: '🎨', label: 'Editor' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-background border-t border-border-color backdrop-blur-md mobile-safe-area nav-height">
      <div className="flex justify-around items-center px-2 py-3 max-w-screen-xl mx-auto h-full">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
            pathname.startsWith(`${item.href}/`) || 
            (item.href === basePath && pathname === basePath);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] ${
                isActive
                  ? 'text-primary bg-card-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-card-background/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeOrgNavItem"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="text-2xl relative z-10">{item.icon}</span>
            </Link>
          );
        })}
        
        {/* Exit organization button - return to main site */}
        <Link
          href="/"
          className="relative flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] text-text-muted hover:text-text-primary hover:bg-card-background/50"
          title="Exit Organization"
        >
          <span className="text-2xl relative z-10">🚪</span>
        </Link>
      </div>
    </nav>
  );
});

export default OrganizationNavigation;
