'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BaseCard from '../components/BaseCard';
import { CARD_FIELDS } from '@/app/lib/constants/fieldNames';
import { createUniqueKey, validateUUID } from '@/app/lib/utils/fieldValidation';
import PageLayout from '../components/PageLayout'; // Import the new layout

interface Card {
  uuid: string;
  type: 'text' | 'media';
  content: {
    text?: string;
    mediaUrl?: string;
  };
  title?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<Card | null>(null);
  const [editedCard, setEditedCard] = useState<Card | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/v1/cards');
      if (!response.ok) throw new Error('Failed to fetch cards');
      const data = await response.json();
      setCards(data.cards);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const handleEdit = (card: Card) => {
    setIsEditing(card);
    setEditedCard({ ...card });
  };

  const handleDelete = async (uuid: string) => {
    if (!validateUUID(uuid)) {
      setError('Invalid card UUID');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    try {
      const response = await fetch(`/api/v1/cards/${uuid}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete card');
      fetchCards();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedCard) return;

    try {
      if (!validateUUID(editedCard[CARD_FIELDS.UUID])) {
        setError('Invalid card UUID');
        return;
      }
      
      const response = await fetch(`/api/v1/cards/${editedCard[CARD_FIELDS.UUID]}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            [CARD_FIELDS.TYPE]: editedCard[CARD_FIELDS.TYPE],
            [CARD_FIELDS.CONTENT]: editedCard[CARD_FIELDS.TYPE] === 'text' 
              ? { text: editedCard[CARD_FIELDS.CONTENT].text }
              : { mediaUrl: editedCard[CARD_FIELDS.CONTENT].mediaUrl },
            [CARD_FIELDS.TITLE]: editedCard[CARD_FIELDS.TITLE],
            [CARD_FIELDS.TAGS]: Array.isArray(editedCard[CARD_FIELDS.TAGS]) ? editedCard[CARD_FIELDS.TAGS] : [],
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to update card');
      fetchCards();
      setIsEditing(null);
      setEditedCard(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  const toggleCardStatus = async (uuid: string, isActive: boolean) => {
    try {
      if (!validateUUID(uuid)) {
        setError('Invalid card UUID');
        return;
      }
      
      const response = await fetch(`/api/v1/cards/${uuid}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ [CARD_FIELDS.IS_ACTIVE]: !isActive }),
        }
      );

      if (!response.ok) throw new Error('Failed to update card status');
      fetchCards();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading cards...</span>
      </div>
    );
  }

  return (
    <PageLayout title="Card Management">
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">All Cards</h2>
      </div>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="results-grid">
        {cards.map((card) => (
          <motion.div
            key={createUniqueKey('card', card[CARD_FIELDS.UUID])}
            layout
            className={`relative group ${
              !card[CARD_FIELDS.IS_ACTIVE] ? 'opacity-50' : ''
            }`}
          >
            <BaseCard
              uuid={card[CARD_FIELDS.UUID]}
              type={card[CARD_FIELDS.TYPE] as 'text' | 'media'}
              content={card[CARD_FIELDS.CONTENT]}
              size="medium"
              className="transition-all duration-200 group-hover:shadow-lg"
            >
              {!card[CARD_FIELDS.IS_ACTIVE] && (
                <div className="absolute top-2 right-2">
                  <span className="status-badge status-error">Inactive</span>
                </div>
              )}
            </BaseCard>

            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-75 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleCardStatus(card[CARD_FIELDS.UUID], card[CARD_FIELDS.IS_ACTIVE])}
                  className={`btn btn-sm ${
                    card[CARD_FIELDS.IS_ACTIVE]
                      ? 'btn-danger'
                      : 'btn-success'
                  }`}
                >
                  {card[CARD_FIELDS.IS_ACTIVE] ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleEdit(card)}
                  className="btn btn-sm btn-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(card[CARD_FIELDS.UUID])}
                  className="btn btn-sm btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {card[CARD_FIELDS.TAGS].length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {card[CARD_FIELDS.TAGS].slice(0, 3).map((tag, tagIndex) => (
                    <span
                      key={createUniqueKey('tag', card[CARD_FIELDS.UUID], tagIndex, tag)}
                      className="status-badge status-info"
                    >
                      {tag}
                    </span>
                  ))}
                  {card[CARD_FIELDS.TAGS].length > 3 && (
                    <span className="status-badge status-info">
                      +{card[CARD_FIELDS.TAGS].length - 3}
                    </span>
                  )}
                </div>
              )}
              
              <div className="text-xs text-muted">
                Created: {new Date(card[CARD_FIELDS.CREATED_AT]).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="content-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Card</h2>
              <button
                onClick={() => {
                  setIsEditing(null);
                  setEditedCard(null);
                }}
                className="text-muted hover:text-primary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="form-label">Type</label>
                <select
                  value={editedCard?.type}
                  onChange={(e) => setEditedCard({ 
                    ...editedCard!, 
                    type: e.target.value as 'text' | 'media',
                    content: e.target.value === 'text' 
                      ? { text: '' } 
                      : { mediaUrl: '' }
                  })}
                  className="form-input"
                >
                  <option value="text">Text</option>
                  <option value="media">Media</option>
                </select>
              </div>

              {editedCard?.type === 'text' ? (
                <div>
                  <label className="form-label">Text Content</label>
                  <textarea
                    value={editedCard.content.text || ''}
                    onChange={(e) => setEditedCard({
                      ...editedCard,
                      content: { ...editedCard.content, text: e.target.value }
                    })}
                    className="form-input"
                    rows={4}
                  />
                </div>
              ) : (
                <div>
                  <label className="form-label">Media URL</label>
                  <input
                    type="url"
                    value={editedCard?.content.mediaUrl || ''}
                    onChange={(e) => setEditedCard({
                      ...editedCard!,
                      content: { ...editedCard!.content, mediaUrl: e.target.value }
                    })}
                    className="form-input"
                  />
                </div>
              )}

              <div>
                <label className="form-label">Title</label>
                <input
                  type="text"
                  value={editedCard?.title || ''}
                  onChange={(e) => setEditedCard({ ...editedCard!, title: e.target.value })}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Tags</label>
                <input
                  type="text"
                  value={Array.isArray(editedCard?.tags) ? editedCard.tags.join(', ') : ''}
                  onChange={(e) => setEditedCard({ 
                    ...editedCard!, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  })}
                  className="form-input"
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(null);
                    setEditedCard(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
    )}
    </PageLayout>
  );
}
