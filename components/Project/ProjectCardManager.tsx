'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { CardErrorBoundary } from '@/components/error/card-error-boundary';

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
  // State management
  const [cards, setCards] = useState(initialCards);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles adding a card to the project
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
              <DialogTitle>Add Card to Project</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {/* Card selection UI */}
              {/* This would be replaced with your actual card selection component */}
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Search cards..."
                  className="w-full px-3 py-2 border rounded-md"
                />
                {/* Card grid would go here */}
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
