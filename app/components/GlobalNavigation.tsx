'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const navigationItems = [
  { href: '/', icon: '🏠', label: 'Home' },
  { href: '/ranks', icon: '🏆', label: 'Global Rankings (ELO)' },
  { href: '/card-editor', icon: '📋', label: 'Card Editor' },
  { href: '/cards', icon: '🗂', label: 'Cards' },
  { href: '/organization-editor', icon: '🏢', label: 'Organizations' }
];

const GlobalNavigation = React.memo(function GlobalNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-background border-t border-border-color backdrop-blur-md mobile-safe-area nav-height">
      <div className="flex justify-around items-center px-2 py-3 max-w-screen-xl mx-auto h-full">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/ranks' && pathname.startsWith('/ranks')) ||
            (item.href === '/card-editor' && pathname.startsWith('/card-editor')) ||
            (item.href === '/cards' && pathname.startsWith('/cards')) ||
            (item.href === '/organization-editor' && pathname.startsWith('/organization-editor'));
          
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
                  layoutId="activeNavItem"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="text-2xl relative z-10">{item.icon}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

export default GlobalNavigation;
