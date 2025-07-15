import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Available aspect ratios for cards */
export type AspectRatio = '1:1' | '4:3' | '16:9' | '21:9';

/** Card variant styles */
export type CardVariant = 'default' | 'outline' | 'shadow' | 'elevated';

/** Card size options */
export type CardSize = 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  /** Type of card content - 'image' or 'text' */
  type: 'image' | 'text';
  /** Main content - URL for image type, text content for text type */
  content: string;
  /** Optional title for the card */
  title?: string;
  /** Optional description text */
  description?: string;
  /** Optional CSS classes to apply to the card container */
  className?: string;
  /** Aspect ratio for the card (defaults to '4:3') */
  aspectRatio?: AspectRatio;
  /** Card visual variant (defaults to 'default') */
  variant?: CardVariant;
  /** Card size preset (defaults to 'md') */
  size?: CardSize;
  /** Translation key for text content */
  translationKey?: string;
  /** Array of hashtags associated with the card */
  hashtags?: string[];
  /** Optional image alt text (if not provided, falls back to title) */
  imageAlt?: string;
}

/**
 * Card component that adapts its rendering based on content type.
 * Supports both image and text content with dark mode compatibility.
 */
/** Get aspect ratio dimensions */
const getAspectRatioDimensions = (ratio: AspectRatio): { width: number; height: number } => {
  switch (ratio) {
    case '1:1': return { width: 400, height: 400 };
    case '16:9': return { width: 400, height: 225 };
    case '21:9': return { width: 400, height: 171 };
    default: return { width: 400, height: 300 }; // 4:3
  }
};

/** Get variant styles */
const getVariantStyles = (variant: CardVariant): string => {
  switch (variant) {
    case 'outline': return 'border border-gray-200 dark:border-gray-700';
    case 'shadow': return 'shadow-md hover:shadow-lg transition-shadow';
    case 'elevated': return 'shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-gray-800';
    default: return 'bg-white dark:bg-gray-800';
  }
};

/** Get size styles */
const getSizeStyles = (size: CardSize): string => {
  switch (size) {
    case 'sm': return 'p-2 text-sm';
    case 'lg': return 'p-6 text-lg';
    case 'xl': return 'p-8 text-xl';
    default: return 'p-4 text-base'; // md
  }
};

export function Card({
  type,
  content,
  title,
  description,
  className,
  aspectRatio = '4:3',
  variant = 'default',
  size = 'md',
  translationKey,
  hashtags = [],
  imageAlt,
}: CardProps) {
const dimensions = getAspectRatioDimensions(aspectRatio);
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <div 
      className={cn(
        'card rounded-lg overflow-hidden',
        variantStyles,
        sizeStyles,
        className
      )}>
      {type === 'image' ? (
        <>
          <div className="card-image">
            <Image
              src={content}
              alt={imageAlt || title || 'Card image'}
              width={dimensions.width}
              height={dimensions.height}
              className="w-full h-auto object-cover"
            />
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
          <p className="text-sm opacity-90" data-translation-key={translationKey}>{content}</p>
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
