import dbConnect from '@/lib/mongodb';
import { Card as CardModel } from '@/models/Card';
import { CardList } from '@/components/ui/CardList';
import { CardFilters } from '@/components/ui/CardFilters';

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
        _id: card._id?.toString() || '',
        type: card.type,
        content: card.content,
        title: card.title,
        description: card.description,
        slug: card.slug,
        hashtags: card.hashtags,
        translationKey: card.translationKey,
        imageAlt: card.imageAlt,
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

import { GetServerSideProps } from 'next';

export default async function CardListPage(props: any) {
  // Parse search parameters
  const searchParams = props.searchParams || {};

  const currentPage = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page) || 1;
  const searchQuery = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  const typeFilter = (Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type) as 'image' | 'text' | undefined;
  const hashtagFilter = typeof searchParams.hashtags === 'string' ? searchParams.hashtags.split(',').filter(Boolean) : [];

  // Ensure the database is connected
  await dbConnect();

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
            href="/cards/create"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Create New Card
          </a>
        </div>

        <CardFilters
          searchQuery={searchQuery}
          typeFilter={typeFilter}
          hashtagFilter={hashtagFilter}
        />

        <CardList
          cards={cards}
          total={total}
          pages={pages}
          currentPage={currentPage}
          searchQuery={searchQuery}
          typeFilter={typeFilter}
          hashtagFilter={hashtagFilter}
        />
      </div>
    </main>
  );
}
