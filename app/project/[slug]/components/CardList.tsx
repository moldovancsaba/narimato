'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const DragDropContext = dynamic(() => import('@hello-pangea/dnd').then((mod) => mod.DragDropContext), { ssr: false });

const Droppable = dynamic(() => import('@hello-pangea/dnd').then((mod) => mod.Droppable), { ssr: false });

const DraggableCard = dynamic(() => import('./DraggableCard'), { ssr: false });

interface Card {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'image';
  order: number;
}

interface CardListProps {
  project: {
    cards: Card[];
  };
  reorderCards: (cardIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Manages the list of draggable cards
 * Handles drag and drop reordering with optimistic updates
 */
export default function CardList({ project, reorderCards }: CardListProps) {
  const [cards, setCards] = useState(project.cards);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(cards);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistic update
    setCards(items);
    setIsReordering(true);
    setError(null);

    try {
      const result = await reorderCards(items.map(card => card.id));
      if (!result.success) {
        throw new Error(result.error || 'Failed to reorder cards');
      }
    } catch (err) {
      setError('Failed to update card order. Please try again.');
      // Revert to original order on error
      setCards(project.cards);
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="mt-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="cards">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-4"
            >
              {cards.map((card, index) => (
                <DraggableCard
                  key={card.id}
                  card={card}
                  index={index}
                  isReordering={isReordering}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

