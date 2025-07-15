'use client';

import { useState, type ReactNode } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Card {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'image';
  order: number;
}

interface DragDropSystemProps {
  project: {
    cards: Card[];
  };
  reorderCards: (cardIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

function Card({ card, isReordering }: { card: Card; isReordering: boolean }) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        p-4 rounded-lg shadow-sm
        hover:shadow-md transition-shadow
        border border-gray-200 dark:border-gray-700
        ${isReordering ? 'opacity-75' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{card.title}</h3>
        <span className="text-gray-500 dark:text-gray-400">
          {card.type === 'image' ? '🖼️' : '📝'}
        </span>
      </div>
      
      <p className="text-gray-600 dark:text-gray-300 line-clamp-2">
        {card.content}
      </p>
    </div>
  );
}

export default function DragDropSystem({ project, reorderCards }: DragDropSystemProps) {
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
                <Draggable key={card.id} draggableId={card.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <Card card={card} isReordering={isReordering} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
