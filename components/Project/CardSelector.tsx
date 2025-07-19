import { useState, useCallback, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { ICard } from '@/models/Card';

interface CardSelectorProps {
  projectSlug: string;
  onCardAdded?: (card: ICard) => void;
  onError?: (error: Error) => void;
}

interface SearchResult {
  _id: string;
  title: string;
  type: 'text' | 'image';
  content: string;
}

export function CardSelector({ projectSlug, onCardAdded, onError }: CardSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Search for cards as user types
  const searchCards = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/cards?search=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error('Failed to search cards');
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching cards:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to search cards'));
    } finally {
      setIsSearching(false);
    }
  }, [onError]);

  // Handle adding a card to the project
  const handleAddCard = async (cardId: string) => {
    setIsAdding(cardId);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId })
      });

      if (!response.ok) throw new Error('Failed to add card to project');
      
      const data = await response.json();
      // Remove the added card from search results
      setSearchResults(prev => prev.filter(card => card._id !== cardId));
      // Close the dialog and trigger refresh
      onCardAdded?.(data);
      setSearchTerm('');  // Clear the search
    } catch (error) {
      console.error('Error adding card:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to add card'));
    } finally {
      setIsAdding(null);
    }
  };

  // Update search results when search term changes
  useEffect(() => {
    searchCards(debouncedSearch);
  }, [debouncedSearch, searchCards]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for cards to add..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {searchResults.length > 0 ? (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden bg-white">
          {searchResults.map((card) => (
            <li 
              key={card._id}
              className="p-4 hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {card.title}
                </h4>
                <p className="text-sm text-gray-500 truncate">
                  {card.type === 'text' ? card.content : 'Image card'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAddCard(card._id)}
                disabled={isAdding === card._id}
                className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding === card._id ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : (
                  'Add'
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : searchTerm && !isSearching ? (
        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-md">
          No cards found matching your search
        </div>
      ) : null}
    </div>
  );
}
