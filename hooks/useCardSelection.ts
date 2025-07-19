import { useState, useCallback, useRef } from 'react';
import { ICard } from '@/models/Card';

/**
 * Filter options for card search
 */
export interface CardFilters {
  type?: 'image' | 'text';
  hashtags?: string[];
  minScore?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Custom hook for managing card selection and search functionality
 * Provides state management and API integration for card selection features
 */
export function useCardSelection() {
  // State management
  const [selectedCards, setSelectedCards] = useState<ICard[]>([]);
  const [searchResults, setSearchResults] = useState<ICard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce search requests
  const searchTimeout = useRef<NodeJS.Timeout>();

  /**
   * Fetch cards based on search query and filters
   * Implements debouncing to prevent excessive API calls
   */
  const searchCards = useCallback(async (query: string, filters?: CardFilters) => {
    try {
      setError(null);
      setIsLoading(true);

      // Clear existing timeout if any
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      // Debounce search request
      searchTimeout.current = setTimeout(async () => {
        const response = await fetch('/api/cards/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim(), filters }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cards');
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch cards');
        }

        setSearchResults(data.cards);
      }, 300); // 300ms debounce delay

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggle selection status of a card
   */
  const toggleCardSelection = useCallback((card: ICard) => {
    setSelectedCards(prev => {
      const isSelected = prev.some(c => c._id === card._id);
      if (isSelected) {
        return prev.filter(c => c._id !== card._id);
      } else {
        return [...prev, card];
      }
    });
  }, []);

  /**
   * Check if a card is currently selected
   */
  const isCardSelected = useCallback((cardId: string) => {
    return selectedCards.some(card => card._id === cardId);
  }, [selectedCards]);

  /**
   * Clear all selected cards
   */
  const clearSelection = useCallback(() => {
    setSelectedCards([]);
  }, []);

  return {
    // State
    selectedCards,
    searchResults,
    isLoading,
    error,

    // Actions
    searchCards,
    toggleCardSelection,
    isCardSelected,
    clearSelection,
  };
}
