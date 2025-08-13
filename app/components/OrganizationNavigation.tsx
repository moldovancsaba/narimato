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
  const slug = params?.slug as string;

  if (!slug) return null;

  const navigationItems = [
    { href: `/${slug}`, icon: '🏠', label: 'Choose Deck' },
    { href: `/${slug}/rankings`, icon: '🏆', label: 'Global Rankings' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-background border-t border-border-color backdrop-blur-md mobile-safe-area nav-height">
      <div className="flex justify-around items-center px-2 py-3 max-w-screen-xl mx-auto h-full">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === `/${slug}/rankings` && pathname.startsWith(`/${slug}/rankings`)) ||
            (item.href === `/${slug}/completed` && pathname.startsWith(`/${slug}/completed`));
          
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
