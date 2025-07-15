import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CardSchema, type CardInput } from '@/lib/validations/card';

interface CardManagerProps {
  cards: CardInput[];
  onAddCard: () => void;
  onRemoveCard: (cardId: string) => Promise<void>;
  onReorderCards: (startIndex: number, endIndex: number) => Promise<void>;
  socket?: any; // Socket.io instance
  projectSlug: string;
}

export const CardManager = ({
  cards,
  onAddCard,
  onRemoveCard,
  onReorderCards,
  socket,
  projectSlug,
}: CardManagerProps) => {
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
