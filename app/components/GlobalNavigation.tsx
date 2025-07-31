'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const navigationItems = [
  { href: '/', icon: '🏠', label: 'Home' },
  { href: '/swipe', icon: '▶️', label: 'Start Session' },
  { href: '/ranks', icon: '🏆', label: 'Global Rankings (ELO)' },
  { href: '/cards', icon: '🃏', label: 'Browse Cards' },
];

export default function GlobalNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-background border-t border-border-color backdrop-blur-md mobile-safe-area" style={{height: '60px'}}>
      <div className="flex justify-around items-center px-2 py-3 max-w-screen-xl mx-auto h-full">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/swipe' && (pathname === '/swipe' || pathname.startsWith('/vote'))) ||
            (item.href === '/cards' && (pathname === '/cards' || pathname === '/card-editor'));
          
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
}
