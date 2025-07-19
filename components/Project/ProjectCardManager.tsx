'use client';

import { useState, useCallback } from 'react';
import { CardSelectionGrid } from '@/components/ui/CardSelectionGrid';
import { SearchAndFilters } from '@/components/ui/SearchAndFilters';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { CardErrorBoundary } from '@/components/error/card-error-boundary';
import { getCardUrl } from '@/app/middleware';

interface ProjectCardManagerProps {
  projectSlug: string;
  initialCards?: Array<{
    id: string;
    title: string;
    content: string;
    type: 'image' | 'text';
    hashtags: string[];
  }>;
}

/**
 * ProjectCardManager Component
 * 
 * Manages the addition, removal, and organization of cards within a project.
 * Features:
 * - Card browsing and selection
 * - Real-time updates
 * - Error handling
 * - Loading states
 * - Responsive layout
 */
export function ProjectCardManager({ projectSlug, initialCards = [] }: ProjectCardManagerProps) {
  const router = useRouter();
  // Temporary auth state placeholder - to be replaced with actual auth implementation
  const isAuthenticated = true; // Placeholder for auth check
  // State management
  const [cards, setCards] = useState(initialCards);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text'>('all');
  const [hashtagFilter, setHashtagFilter] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles adding selected cards to the project
   * Includes error handling and loading states
   */
  const handleAddSelectedCards = useCallback(async () => {
    if (selectedCards.length === 0) {
      toast.error('Please select at least one card');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add all selected cards in parallel
      await Promise.all(
        selectedCards.map(async (cardId) => {
          const response = await fetch(`/api/projects/${projectSlug}/cards`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cardId }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || `Failed to add card ${cardId} to project`);
          }

          return response.json();
        })
      );

      // Update local state and show success message
      toast.success(`Added ${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} successfully`);
      setIsModalOpen(false);
      setSelectedCards([]);
      
      // Refresh the page to show updated cards
      router.refresh();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cards');
      toast.error('Failed to add cards to project');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCards, projectSlug, router]);

  /**
   * Handles card selection in the grid
   */
  const handleCardSelection = useCallback((cardId: string) => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else {
        return [...prev, cardId];
      }
    });
  }, []);

  /**
   * Handles adding a single card to the project
   * Includes error handling and loading states
   */
  const handleAddCard = useCallback(async (cardId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectSlug}/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add card to project');
      }

      // Update local state and show success message
      const data = await response.json();
      setCards(prev => [...prev, data.card]);
      toast.success('Card added successfully');
      setIsModalOpen(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card');
      toast.error('Failed to add card to project');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug]);

  /**
   * Handles removing a card from the project
   * Includes error handling and loading states
   */
  const handleRemoveCard = useCallback(async (cardId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectSlug}/cards`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove card from project');
      }

      // Update local state and show success message
      setCards(prev => prev.filter(card => card.id !== cardId));
      toast.success('Card removed successfully');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove card');
      toast.error('Failed to remove card from project');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug]);

  return (
    <CardErrorBoundary>
      <div className="space-y-4">
        {/* Card list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.id} className="relative group">
              <Card
                type={card.type}
                content={card.content}
                title={card.title}
                hashtags={card.hashtags}
                slug={card.id}
                createdAt={new Date().toISOString()}
                updatedAt={new Date().toISOString()}
                onClick={() => router.push(getCardUrl({ _id: card.id, slug: card.id }, true))}
                isInteractive
              />
              <button
                onClick={() => handleRemoveCard(card.id)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isLoading}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Add card button */}
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : null}
          Add Card to Project
        </Button>

        {/* Card selection modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add Cards to Project</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-6">
              <SearchAndFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                hashtagFilter={hashtagFilter}
                onHashtagFilterChange={setHashtagFilter}
                onClearFilters={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setHashtagFilter([]);
                }}
              />
              <CardSelectionGrid
                onSelect={handleCardSelection}
                selectedCards={selectedCards}
                isLoading={isLoading}
              />
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSelectedCards}
                  disabled={isLoading || selectedCards.length === 0}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Adding Cards...
                    </>
                  ) : (
                    `Add ${selectedCards.length} Card${selectedCards.length !== 1 ? 's' : ''}`
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Error display */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>
    </CardErrorBoundary>
  );
}
