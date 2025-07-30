'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const navigationItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/swipe', label: 'Rank', icon: '🏆' },
  { href: '/completed', label: 'Ranks', icon: '📊' },
  { href: '/cards', label: 'Cards', icon: '📱' },
];

export default function GlobalNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-background border-t border-border-color backdrop-blur-md mobile-safe-area">
      <div className="flex justify-around items-center px-2 py-2 max-w-screen-xl mx-auto">
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
              <span className="text-lg mb-1 relative z-10">{item.icon}</span>
              <span className="text-xs font-medium relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
