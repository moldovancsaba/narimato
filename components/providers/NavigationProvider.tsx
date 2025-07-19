"use client";

import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { ProjectPlayNavigation } from '@/components/ui/ProjectPlayNavigation';

interface NavigationProviderProps {
  children: React.ReactNode;
  userRole?: string; // New prop for role-based navigation
}

const isSpecialRoute = (pathname: string) => {
  return [
    '/project/',
    '/create/',
    '/dashboard/',  // Example of additional special route
    '/settings/',   // Another example
  ].some(pattern => pathname.startsWith(pattern));
};

export const NavigationProvider = ({ children, userRole }: NavigationProviderProps) => {
  const pathname = usePathname() || '/';
  
  const isProjectPage = pathname.startsWith('/project/');
  const showNavigation = isSpecialRoute(pathname);
  const isAdmin = userRole === 'admin'; // Role-based logic example

  return (
    <>
      {showNavigation ? (
        isProjectPage ? (
          <ProjectPlayNavigation projectSlug={pathname.split('/')[2]} />
        ) : (
          <Navigation isAdmin={isAdmin} /> // Pass role information
        )
      ) : null} // Navigation visibility rule

      {children}
    </>
  );
};
