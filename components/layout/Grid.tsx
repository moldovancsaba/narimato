/**
 * Grid Component
 * A responsive grid layout component that automatically adjusts columns based on screen size
 * Uses CSS Grid for optimal responsive behavior
 */
export default function Grid({
  children,
  className = '',
  cols = {
    mobile: 1,    // 1 column on mobile
    tablet: 2,    // 2 columns on tablet
    desktop: 3,   // 3 columns on desktop
  }
}: {
  children: React.ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}) {
  const gridClass = `grid grid-cols-${cols.mobile} md:grid-cols-${cols.tablet} lg:grid-cols-${cols.desktop} gap-4 ${className}`;
  
  return (
    <div className={gridClass}>
      {children}
    </div>
  );
}
