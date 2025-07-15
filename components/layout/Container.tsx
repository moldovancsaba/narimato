/**
 * Container Component
 * A responsive wrapper component that maintains consistent padding and max-width
 * Used as the main content container across all pages
 */
export default function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
