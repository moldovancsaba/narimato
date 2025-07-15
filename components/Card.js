import Image from 'next/image';

/**
 * Card Component - The foundational display unit of the Narimato system.
 * Following strict rules from narimato.md:
 * - No internal styling decisions
 * - Container-controlled styling
 * - Fixed 3:4 aspect ratio for text, original ratio for images
 * - Support for translations and hashtags
 */
export default function Card({
  type,
  content,
  title,
  slug,
  hashtags = [],
  translationKey,
  createdAt,
  updatedAt,
  imageAlt,
}) {
  const isImage = type === 'image';

  return (
    <div
      data-card-slug={slug}
      data-card-type={type}
      data-created-at={createdAt.toISOString()}
      data-updated-at={updatedAt.toISOString()}
      className="card relative w-full h-full"
    >
      {isImage ? (
        <div className="w-full h-full relative">
          <Image
            src={content}
            alt={imageAlt || title || 'Card image'}
            fill
            className="object-contain"
            sizes="(max-width: 500px) 100vw, 500px"
          />
        </div>
      ) : (
        <div className="aspect-[3/4] flex items-center justify-center p-4">
          <p 
            className="text-balance text-center" 
            style={{ fontSize: 'min(5vw, 24px)' }}
            data-translation-key={translationKey}
          >
            {content}
          </p>
        </div>
      )}

      {(title || hashtags.length > 0) && (
        <div className="card-meta mt-2">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {hashtags.map((tag) => (
                <span 
                  key={tag} 
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full"
                >
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
