'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

interface NavigationProps {
  isAdmin?: boolean;
}

export function Navigation({ isAdmin = false }: NavigationProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === path;
    return pathname?.startsWith(path);
  };

  // Group 1: Core Management - Primary entry points for users
  // Group 2: Interactive Features - User engagement features
  // Group 3: Creation & Overview - Dashboard and content creation
  const navigationItems = [
    // Core Management
    { path: '/projects', label: 'Projects', roles: ['user', 'admin'] },
    { path: '/cards', label: 'Cards', roles: ['user', 'admin'] },
    
    // Interactive Features
    { path: '/swipe', label: 'Swipe', roles: ['user', 'admin'] },
    { path: '/vote', label: 'Vote', roles: ['user', 'admin'] },
    { path: '/leaderboard', label: 'Leaderboard', roles: ['user', 'admin'] },
    
    // Creation & Overview
    { path: '/create', label: 'Create', roles: ['admin'] },
    { path: '/dashboard', label: 'Dashboard', roles: ['admin'] },
    
    // Admin Only
    { path: '/settings', label: 'Settings', roles: ['admin'] },
    { path: '/analytics', label: 'Analytics', roles: ['admin'] }
  ].filter(item => isAdmin || item.roles.includes('user'));

  useEffect(() => {
    // Close mobile menu when viewport changes to desktop
    const handleResize = () => {
      if (window.innerWidth >= 768 && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg relative transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo or Brand */}
          <div className="flex-shrink-0 flex items-center">
            <span className="text-xl font-bold text-gray-900 dark:text-white cursor-default">
              Narimato
            </span>
          </div>


          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-3 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors duration-200 touch-manipulation"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <X className="block h-6 w-6 transform transition-transform duration-200" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6 transform transition-transform duration-200" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex md:space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-all duration-200 ${isActive(item.path)
                    ? 'border-blue-500 text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div 
        className={`md:hidden transform transition-all duration-200 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 shadow-lg rounded-b-lg bg-white dark:bg-gray-800">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`block px-4 py-3 rounded-md text-base font-medium transition-all duration-200 touch-manipulation ${isActive(item.path)
                  ? 'bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white active:bg-gray-100 dark:active:bg-gray-600'
              }`}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
