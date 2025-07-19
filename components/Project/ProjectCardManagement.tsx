'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CardManager from './CardManager';
import { type CardInput } from '@/lib/validations/card';

interface ProjectCardManagementProps {
  projectSlug: string;
  initialCards: CardInput[];
  socket?: any;
}

export const ProjectCardManagement = ({
  projectSlug,
  initialCards,
  socket,
}: ProjectCardManagementProps) => {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards.map((card, index) => ({
    id: card.slug,
    title: card.title,
    description: card.content,
    order: index
  })));

  const handleAddCard = useCallback(() => {
    router.push(`/cards/create?projectSlug=${projectSlug}`);
  }, [projectSlug, router]);

  const handleRemoveCard = useCallback(async (cardId: string) => {
    try {
      const response = await fetch(`/api/manage/cards/${cardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove card');
      }

      setCards((prevCards) => prevCards.filter((card) => card.id !== cardId));

      // Broadcast card removal
      if (socket) {
        socket.emit('card:remove', {
          projectSlug,
          cardId,
        });
      }
    } catch (error) {
      console.error('Error removing card:', error);
      throw error;
    }
  }, [projectSlug, socket]);

  const handleReorderCards = useCallback(async (startIndex: number, endIndex: number) => {
    try {
      const newCards = [...cards];
      const [movedCard] = newCards.splice(startIndex, 1);
      newCards.splice(endIndex, 0, movedCard);
      setCards(newCards);

      const response = await fetch(`/api/manage/projects/${projectSlug}/cards/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardIds: newCards.map((card) => card.id),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder cards');
      }
    } catch (error) {
      console.error('Error reordering cards:', error);
      throw error;
    }
  }, [cards, projectSlug]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <CardManager
        cards={cards}
        onOrderChange={(updatedCards) => {
          const changes = cards.reduce<{ card: typeof cards[0]; from: number; to: number; }[]>((acc, curr, idx) => {
            const updatedIdx = updatedCards.findIndex(uc => uc.id === curr.id);
            if (updatedIdx !== idx) {
              acc.push({ card: curr, from: idx, to: updatedIdx });
            }
            return acc;
          }, []);
          if (changes.length > 0) {
            handleReorderCards(changes[0].from, changes[0].to);
          }
        }}
      />
    </div>
  );
};
