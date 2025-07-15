import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Card Component - The foundational display unit of the Narimato system.
 * 
 * This component strictly follows the Card Rules from narimato.md:
 * - It is the smallest unit, used consistently across all modules
 * - Contains no internal styling logic - all styling is controlled by the container
 * - Adapts content based on type (image or text) while maintaining consistent structure
 * - Uses global CSS only (no component-specific styles)
 */

/** Props interface for the Card component */
interface CardProps {
  /** Type of card - either 'image' (uses original aspect ratio) or 'text' (fixed 3:4) */
  type: 'image' | 'text';
  /** Content - URL for image type, text content for text type */
  content: string;
  /** Optional title for the card */
  title?: string;
  /** Optional description text */
  description?: string;
  /** Container-provided CSS classes - all styling must come from container */
  className?: string;
  /** Unique slug for direct card access */
  slug: string;
  /** Array of hashtags for filtering */
  hashtags: string[];
  /** Translation key for text content internationalization */
  translationKey?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Optional image alt text for accessibility */
  imageAlt?: string;
}

/**
 * Card component that adapts its rendering based on content type.
 * Supports both image and text content with dark mode compatibility.
 */
/**
 * The Card component's render function.
 * Follows strict rules from narimato.md:
 * - No internal styling decisions
 * - Adapts content based on type while maintaining consistent structure
 * - Uses container-based styling system
 * - Supports text internationalization
 */
export function Card({
  type,
  content,
  title,
  description,
  className,
  slug,
  hashtags,
  translationKey,
  createdAt,
  updatedAt,
  imageAlt,
}: CardProps) {
  return (
    <div 
      className={cn(
        'card',
        // Container must provide all styling
        className
      )}
      data-card-slug={slug}
      data-card-type={type}
      data-created-at={createdAt.toISOString()}
      data-updated-at={updatedAt.toISOString()}>
      {type === 'image' ? (
        <>
          <div className="card-image w-[min(100vw,500px)]">
            <Image
              src={content}
              alt={imageAlt || title || 'Card image'}
              fill
              className="object-contain w-full h-full"
              sizes="(max-width: 500px) 100vw, 500px"
          </div>
          {(title || description) && (
            <div className="card-content">
              {title && <h3 className="text-lg font-semibold">{title}</h3>}
              {description && <p className="text-sm opacity-90">{description}</p>}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {hashtags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="card-content">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          <div className="aspect-[3/4] flex items-center justify-center p-4">
            <p 
              className="text-balance text-center" 
              style={{ fontSize: 'min(5vw, 24px)' }}
              data-translation-key={translationKey}
            >
              {content}
            </p>
          </div>
          {description && (
            <p className="text-sm opacity-70 mt-2">{description}</p>
          )}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {hashtags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
