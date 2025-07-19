'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchAndFilters } from './SearchAndFilters';

interface Card {
  _id: string;
  type: 'image' | 'text';
  content: string;
  title: string;
  description?: string;
  imageAlt?: string;
  hashtags: string[];
}

interface CardSelectionGridProps {
  onSelect: (cardId: string) => void;
  selectedCards: string[];
  isLoading?: boolean;
}

export function CardSelectionGrid({
  onSelect,
  selectedCards = [],
  isLoading = false,
}: CardSelectionGridProps) {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text'>('all');
  const [hashtagFilter, setHashtagFilter] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search query to prevent too many API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Effect to fetch cards when search or filters change
  useEffect(() => {
    const fetchCards = async () => {
      try {
        setIsSearching(true);
        
        // Build query parameters
        const params = new URLSearchParams();
        if (debouncedSearch) params.append('q', debouncedSearch);
        if (typeFilter !== 'all') params.append('type', typeFilter);
        if (hashtagFilter.length > 0) params.append('hashtags', hashtagFilter.join(','));

        const response = await fetch(`/api/manage/cards/search?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch cards');
        
        const data = await response.json();
        setCards(data.cards);
      } catch (error) {
        console.error('Error fetching cards:', error);
        // You might want to show an error message to the user here
      } finally {
        setIsSearching(false);
      }
    };

    fetchCards();
  }, [debouncedSearch, typeFilter, hashtagFilter]);

  // Handle card selection
  const handleCardClick = (cardId: string) => {
    onSelect(cardId);
  };

  // Handle filter changes
  const handleTypeFilterChange = (type: 'all' | 'image' | 'text') => {
    setTypeFilter(type);
  };

  const handleHashtagFilterChange = (hashtags: string) => {
    setHashtagFilter(hashtags.split(',').map(tag => tag.trim()).filter(Boolean));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setHashtagFilter([]);
  };

  return (
    <div className="space-y-6">
      <SearchAndFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        hashtagFilter={hashtagFilter}
        onHashtagFilterChange={setHashtagFilter}
        onClearFilters={clearFilters}
      />

      {/* Cards Grid */}
      {isLoading || isSearching ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="text-gray-500">Loading cards...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div
              key={card._id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedCards.includes(card._id)
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'hover:border-gray-400'
              }`}
              onClick={() => handleCardClick(card._id)}
            >
              <div className="space-y-2">
                <h3 className="font-semibold">{card.title}</h3>
                {card.description && (
                  <p className="text-sm text-gray-600">{card.description}</p>
                )}
                {card.type === 'image' && (
                  <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-sm text-gray-500">Image Preview</span>
                  </div>
                )}
                {card.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {card.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-xs rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="absolute top-2 right-2">
                <input
                  type="checkbox"
                  checked={selectedCards.includes(card._id)}
                  onChange={() => handleCardClick(card._id)}
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          ))}
          {cards.length === 0 && !isSearching && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No cards found. Try adjusting your search or filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
