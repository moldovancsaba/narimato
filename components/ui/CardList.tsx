'use client';

import { Card } from '@/components/ui/Card';
import { CardContainer } from '@/components/ui/CardContainer';

interface CardListProps {
  cards: {
    type: 'image' | 'text';
    content: string;
    title: string;
    description?: string;
    slug: string;
    hashtags: string[];
    translationKey?: string;
    imageAlt?: string;
    createdAt: string;
    updatedAt: string;
  }[];
  total: number;
  pages: number;
  currentPage: number;
  searchQuery?: string;
  typeFilter?: 'image' | 'text';
  hashtagFilter?: string[];
}

export function CardList({
  cards,
  total,
  pages,
  currentPage,
  searchQuery,
  typeFilter,
  hashtagFilter,
}: CardListProps) {
  return (
    <>
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
                createdAt={card.createdAt}
                updatedAt={card.updatedAt}
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
    </>
  );
}
