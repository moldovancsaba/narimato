'use client';

import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

// Types that match our card model structure
interface Card {
  _id: string;
  type: 'image' | 'text';
  content: string;
  title: string;
  description?: string;
  imageAlt?: string;
  hashtags: string[];
  likes: number;
  dislikes: number;
  globalScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CardSelectorProps {
  selectedCards?: string[]; // Array of card IDs that are currently selected
  onCardSelect?: (cardId: string) => void; // Callback when a card is selected
  onCardDeselect?: (cardId: string) => void; // Callback when a card is deselected
  onCardCreate?: (cardData: Omit<Card, '_id' | 'likes' | 'dislikes' | 'globalScore' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  isManageMode?: boolean; // Whether to show management actions
}

export function CardSelector({
  selectedCards = [],
  onCardSelect,
  onCardDeselect,
  onCardCreate,
  isManageMode = false,
}: CardSelectorProps) {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCard, setNewCard] = useState<Omit<Card, '_id' | 'likes' | 'dislikes' | 'globalScore' | 'createdAt' | 'updatedAt'>>({
    type: 'text',
    content: '',
    title: '',
    description: '',
    hashtags: [],
  });

  // Debounced search function to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/manage/cards/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setCards(data.cards);
      } catch (error) {
        console.error('Failed to search cards:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  // Effect to trigger search when query changes
  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setCards([]);
    }
  }, [searchQuery, debouncedSearch]);

  // Handle card selection/deselection
  const handleCardToggle = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      onCardDeselect?.(cardId);
    } else {
      onCardSelect?.(cardId);
    }
  };

  // Handle new card creation
  const handleCreateCard = async () => {
    if (!onCardCreate) return;

    try {
      setIsCreating(true);
      await onCardCreate(newCard);
      // Reset form after successful creation
      setNewCard({
        type: 'text',
        content: '',
        title: '',
        description: '',
        hashtags: [],
      });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create card:', error);
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search cards..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Card List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          cards.map((card) => (
            <div
              key={card._id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedCards.includes(card._id)
                  ? 'bg-blue-50 border-blue-500'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleCardToggle(card._id)}
            >
              <h3 className="font-semibold">{card.title}</h3>
              {card.description && (
                <p className="text-sm text-gray-600 mt-1">{card.description}</p>
              )}
              {card.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
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
          ))
        )}
      </div>

      {/* Create New Card Form (only shown in manage mode) */}
      {isManageMode && onCardCreate && (
        <div className="border-t pt-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">Create New Card</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                className="w-full px-4 py-2 border rounded-lg"
                value={newCard.type}
                onChange={(e) =>
                  setNewCard({ ...newCard, type: e.target.value as Card['type'] })
                }
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-lg"
                value={newCard.title}
                onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                className="w-full px-4 py-2 border rounded-lg"
                value={newCard.content}
                onChange={(e) => setNewCard({ ...newCard, content: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-lg"
                value={newCard.description}
                onChange={(e) =>
                  setNewCard({ ...newCard, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Hashtags (comma-separated)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-lg"
                value={newCard.hashtags.join(', ')}
                onChange={(e) =>
                  setNewCard({
                    ...newCard,
                    hashtags: e.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <button
              className={`w-full py-2 px-4 rounded-lg bg-blue-500 text-white font-medium ${
                isCreating
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-blue-600 transition-colors'
              }`}
              onClick={handleCreateCard}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
