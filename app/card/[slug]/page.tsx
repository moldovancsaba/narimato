import { notFound } from 'next/navigation';
import { Card } from '@/models/Card';
import { CardContainer } from '@/components/ui/CardContainer';
import { Card as CardComponent } from '@/components/ui/Card';

/**
 * Individual Card Page Component
 * Provides both viewing and editing capabilities for a single card
 * Access via /card/[slug]
 */

interface CardPageProps {
  params: {
    slug: string;
  };
}

/**
 * Fetches card data from MongoDB using the provided slug
 * Returns null if card is not found or is soft-deleted
 */
async function getCardBySlug(slug: string) {
  try {
    const card = await Card.findOne({ 
      slug,
      isDeleted: false 
    }).lean();
    
    if (!card) {
      return null;
    }

    return {
      ...card,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Error fetching card:', error);
    return null;
  }
}

export default async function CardPage({ params }: CardPageProps) {
  const card = await getCardBySlug(params.slug);

  if (!card) {
    notFound();
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">
        {/* Card Preview Section */}
        <section className="mb-8">
          <h1 className="text-2xl font-bold mb-4">Card Preview</h1>
          <CardContainer cardType={card.type}>
            <CardComponent
              type={card.type}
              content={card.content}
              title={card.title}
              description={card.description}
              slug={card.slug}
              hashtags={card.hashtags}
              translationKey={card.translationKey}
              createdAt={new Date(card.createdAt)}
              updatedAt={new Date(card.updatedAt)}
              imageAlt={card.imageAlt}
            />
          </CardContainer>
        </section>

        {/* Card Details Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Card Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="font-medium">Type</dt>
              <dd className="text-gray-600 dark:text-gray-300">{card.type}</dd>
            </div>
            <div>
              <dt className="font-medium">Created</dt>
              <dd className="text-gray-600 dark:text-gray-300">
                {new Date(card.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Last Updated</dt>
              <dd className="text-gray-600 dark:text-gray-300">
                {new Date(card.updatedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Hashtags</dt>
              <dd className="flex flex-wrap gap-2">
                {card.hashtags.map((tag) => (
                  <span 
                    key={tag}
                    className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </dd>
            </div>
            {card.translationKey && (
              <div>
                <dt className="font-medium">Translation Key</dt>
                <dd className="text-gray-600 dark:text-gray-300">
                  {card.translationKey}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Card Actions Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              // Edit functionality will be implemented in the next phase
            >
              Edit Card
            </button>
            <button
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
              // Delete functionality will be implemented in the next phase
            >
              Delete Card
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
