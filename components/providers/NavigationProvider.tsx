"use client";

import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { ProjectPlayNavigation } from '@/components/ui/ProjectPlayNavigation';

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const pathname = usePathname() || '/';
  const isProjectPage = pathname.startsWith('/project/');
  
  return (
    <>
      {isProjectPage ? <ProjectPlayNavigation projectSlug={pathname.split('/')[2]} /> : <Navigation />}
      {children}
    </>
  );
};
