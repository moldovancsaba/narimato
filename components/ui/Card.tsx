import Image from 'next/image';
import { cn } from '@/lib/utils';

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
  /** Image width for image type cards */
  imageWidth?: number;
  /** Image height for image type cards */
  imageHeight?: number;
}

/**
 * Card component that adapts its rendering based on content type.
 * Supports both image and text content with dark mode compatibility.
 */
export function Card({
  type,
  content,
  title,
  description,
  className,
  imageWidth = 400,
  imageHeight = 300,
}: CardProps) {
  return (
    <div className={cn('card', className)}>
      {type === 'image' ? (
        <>
          <div className="card-image">
            <Image
              src={content}
              alt={title || 'Card image'}
              width={imageWidth}
              height={imageHeight}
              className="w-full h-auto object-cover"
            />
          </div>
          {(title || description) && (
            <div className="card-content">
              {title && <h3 className="text-lg font-semibold">{title}</h3>}
              {description && <p className="text-sm opacity-90">{description}</p>}
            </div>
          )}
        </>
      ) : (
        <div className="card-content">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          <p className="text-sm opacity-90">{content}</p>
          {description && (
            <p className="text-sm opacity-70 mt-2">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
