'use client';

import { ReactNode } from 'react';

/**
 * Props interface for the MobileLayout component
 */
interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  withSafeArea?: boolean;
  fullHeight?: boolean;
}

/**
 * MobileLayout Component - Universal mobile-first responsive layout wrapper
 * 
 * This component provides:
 * - Mobile-first responsive container with proper padding
 * - Safe area inset support for modern mobile devices
 * - Consistent spacing and layout patterns
 * - Flexible configuration for different page types
 * 
 * Usage Examples:
 * - Basic: <MobileLayout>Content</MobileLayout>
 * - With safe area: <MobileLayout withSafeArea>Content</MobileLayout>
 * - Full height: <MobileLayout fullHeight>Content</MobileLayout>
 * - Custom styling: <MobileLayout className="bg-blue-50">Content</MobileLayout>
 */
export default function MobileLayout({
  children,
  className = '',
  containerClassName = '',
  withSafeArea = true,
  fullHeight = true
}: MobileLayoutProps) {
  const baseClasses = fullHeight ? 'min-h-screen' : 'min-h-0';
  const safeAreaClasses = withSafeArea ? 'mobile-safe-area' : '';
  
  return (
    <div className={`${baseClasses} ${safeAreaClasses} ${className}`}>
      <div className={`mobile-container ${containerClassName}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * MobilePageHeader Component - Standardized page header for mobile-first design
 */
interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function MobilePageHeader({ 
  title, 
  subtitle, 
  className = '' 
}: MobilePageHeaderProps) {
  return (
    <div className={`text-center py-6 sm:py-8 ${className}`}>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4 text-balance">
        {title}
      </h1>
      {subtitle && (
        <p className="text-base sm:text-lg text-gray-600 text-balance">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/**
 * MobileCardGrid Component - Responsive card grid for mobile-first design
 */
interface MobileCardGridProps {
  children: ReactNode;
  columns?: 'auto' | 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MobileCardGrid({ 
  children, 
  columns = 'auto',
  gap = 'md',
  className = ''
}: MobileCardGridProps) {
  const gapClasses = {
    sm: 'gap-3 sm:gap-4',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8'
  };
  
  const columnClasses = {
    auto: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  };
  
  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * MobileButtonGroup Component - Responsive button group for mobile-first design
 */
interface MobileButtonGroupProps {
  children: ReactNode;
  orientation?: 'horizontal' | 'vertical' | 'responsive';
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MobileButtonGroup({ 
  children, 
  orientation = 'responsive',
  gap = 'md',
  className = ''
}: MobileButtonGroupProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };
  
  const orientationClasses = {
    horizontal: 'flex flex-row',
    vertical: 'flex flex-col',
    responsive: 'flex flex-col sm:flex-row'
  };
  
  return (
    <div className={`${orientationClasses[orientation]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}
