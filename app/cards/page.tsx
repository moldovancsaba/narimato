import { Card as CardModel } from '@/models/Card';
import { CardContainer } from '@/components/ui/CardContainer';
import { Card } from '@/components/ui/Card';

/**
 * Card List Page Component
 * Displays a filterable grid of cards with search and hashtag filtering
 */

interface CardListPageProps {
  searchParams: {
    q?: string;
    type?: 'image' | 'text';
    hashtags?: string;
    page?: string;
  };
}

// Cards per page for pagination
const CARDS_PER_PAGE = 12;

/**
 * Fetches cards from MongoDB with filtering and pagination
 */
async function getCards({
  search,
  type,
  hashtags,
  page = 1,
}: {
  search?: string;
  type?: 'image' | 'text';
  hashtags?: string[];
  page?: number;
}) {
  try {
    // Build the query
    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    if (type) {
      query.type = type;
    }

    if (hashtags?.length) {
      query.hashtags = { $in: hashtags };
    }

    // Execute query with pagination
    const cards = await CardModel
      .find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * CARDS_PER_PAGE)
      .limit(CARDS_PER_PAGE)
      .lean();

    // Get total count for pagination
    const total = await CardModel.countDocuments(query);

    return {
      cards: cards.map(card => ({
        ...card,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString(),
      })),
      total,
      pages: Math.ceil(total / CARDS_PER_PAGE),
    };
  } catch (error) {
    console.error('Error fetching cards:', error);
    return {
      cards: [],
      total: 0,
      pages: 0,
    };
  }
}

export default async function CardListPage({ searchParams }: CardListPageProps) {
  // Parse search parameters
  const currentPage = Number(searchParams.page) || 1;
  const searchQuery = searchParams.q;
  const typeFilter = searchParams.type as 'image' | 'text' | undefined;
  const hashtagFilter = searchParams.hashtags?.split(',').filter(Boolean);

  // Fetch cards with filters
  const { cards, total, pages } = await getCards({
    search: searchQuery,
    type: typeFilter,
    hashtags: hashtagFilter,
    page: currentPage,
  });

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Cards</h1>
          <a
            href="/card/edit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Create New Card
          </a>
        </div>

        {/* Filters */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Filters</h2>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">Search</label>
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                className="w-full px-3 py-2 border rounded"
                placeholder="Search cards..."
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Type</label>
              <select
                name="type"
                defaultValue={typeFilter}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">All Types</option>
                <option value="image">Image Cards</option>
                <option value="text">Text Cards</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Hashtags</label>
              <input
                type="text"
                name="hashtags"
                defaultValue={hashtagFilter?.join(',')}
                className="w-full px-3 py-2 border rounded"
                placeholder="nature,art,photography"
              />
            </div>
          </form>
        </section>

        {/* Results Count */}
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Showing {cards.length} of {total} cards
        </p>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map((card) => (
            <CardContainer
              key={card.slug}
              cardType={card.type}
              isList
            >
              <a href={`/card/${card.slug}`}>
                <Card
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
              </a>
            </CardContainer>
          ))}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((page) => (
              <a
                key={page}
                href={`/cards?page=${page}${searchQuery ? `&q=${searchQuery}` : ''}${
                  typeFilter ? `&type=${typeFilter}` : ''
                }${hashtagFilter?.length ? `&hashtags=${hashtagFilter.join(',')}` : ''}`}
                className={`px-4 py-2 rounded ${
                  currentPage === page
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                {page}
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
