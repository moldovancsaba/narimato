'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { type CardInput } from '@/lib/validations/card';

/**
 * Props for the CardManager component
 *
 * @interface CardManagerProps
 */
interface CardManagerProps {
  /** Array of card data to be managed */
  cards: CardInput[];
  /** Callback to handle adding a new card */
  onAddCard: () => void;
  /** Callback to handle card removal with automatic error handling */
  onRemoveCard: (cardId: string) => Promise<void>;
  /** Callback to handle card reordering with automatic error handling */
  onReorderCards: (startIndex: number, endIndex: number) => Promise<void>;
  /** Optional Socket.io instance for real-time updates */
  socket?: any;
  /** Project identifier for real-time event broadcasting */
  projectSlug: string;
}

/**
 * CardManager Component
 *
 * A comprehensive card management interface that provides drag-and-drop reordering,
 * card addition/removal, and real-time synchronization capabilities. Integrates with
 * Socket.io for live updates across multiple clients.
 *
 * Features:
 * - Drag and drop card reordering
 * - Add/remove card functionality
 * - Real-time updates via Socket.io
 * - Visual feedback for interactions
 * - Responsive grid layout
 * - Support for both image and text cards
 * - Automatic error handling
 */
export const CardManager = ({
  cards,
  onAddCard,
  onRemoveCard,
  onReorderCards,
  socket,
  projectSlug,
}: CardManagerProps) => {
  /**
   * Handles the completion of a drag operation.
   * Updates card order locally and broadcasts the change to other clients.
   *
   * @param result - The drag result object from react-beautiful-dnd
   */
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    await onReorderCards(sourceIndex, destinationIndex);

    // Broadcast the reorder event
    if (socket) {
      socket.emit('card:reorder', {
        projectSlug,
        sourceIndex,
        destinationIndex,
        cardIds: cards.map(card => card.slug)
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with card count and add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Cards ({cards.length})
        </h3>
        <button
          type="button"
          onClick={onAddCard}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="mr-2 h-5 w-5" />
          Add Card
        </button>
      </div>

      {/* Drag and drop container for card reordering */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="cards">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {cards.map((card, index) => (
                <Draggable
                  key={card.slug}
                  draggableId={card.slug}
                  index={index}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
                    >
                      {/* Card content with thumbnail and details */}
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 w-12 h-12">
                          {card.type === 'image' ? (
                            <img
                              src={card.content}
                              alt={card.imageAlt}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center text-gray-500">
                              Text
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {card.title}
                          </h4>
                          {card.description && (
                            <p className="text-sm text-gray-500">
                              {card.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveCard(card.slug)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
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
};
