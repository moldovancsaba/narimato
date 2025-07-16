'use client';

import dynamic from 'next/dynamic';

const Draggable = dynamic(() => import('@hello-pangea/dnd').then((mod) => mod.Draggable), { ssr: false });

/**
 * Represents a card in the system with its core properties
 *
 * @interface Card
 */
interface Card {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'image';
}

/**
 * Props for the DraggableCard component
 *
 * @interface DraggableCardProps
 */
interface DraggableCardProps {
  card: Card;
  index: number;
  isReordering: boolean;
}

/**
 * DraggableCard Component
 *
 * A client-side component that renders an individual card with drag-and-drop
 * capabilities. Handles drag interactions and displays card content with
 * visual feedback during reordering operations.
 *
 * Features:
 * - Drag handle integration
 * - Visual transition states
 * - Dark mode support
 * - Type-specific icon display
 * - Content truncation
 * - Loading state visual feedback
 */
export default function DraggableCard({ card, index, isReordering }: DraggableCardProps) {
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            bg-white dark:bg-gray-800 
            p-4 rounded-lg shadow-sm
            hover:shadow-md transition-shadow
            border border-gray-200 dark:border-gray-700
            ${isReordering ? 'opacity-75' : ''}
          `}
        >
          {/* Card header with title and type indicator */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">{card.title}</h3>
            <span className="text-gray-500 dark:text-gray-400">
              {card.type === 'image' ? '🖼️' : '📝'}
            </span>
          </div>
          
          {/* Truncated card content preview */}
          <p className="text-gray-600 dark:text-gray-300 line-clamp-2">
            {card.content}
          </p>
        </div>
      )}
    </Draggable>
  );
}

