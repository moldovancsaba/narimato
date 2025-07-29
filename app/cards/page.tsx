'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BaseCard from '../components/BaseCard';
import { CARD_FIELDS } from '@/app/lib/constants/fieldNames';
import { createUniqueKey, validateUUID } from '@/app/lib/utils/fieldValidation';

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
  const [newCard, setNewCard] = useState({
    type: 'text',
    content: { text: '', mediaUrl: '' },
    title: '',
    tags: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/v1/cards/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: newCard.type,
          content: newCard.type === 'text' 
            ? { text: newCard.content.text }
            : { mediaUrl: newCard.content.mediaUrl },
          title: newCard.title,
          tags: newCard.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        }),
      });

      if (!response.ok) throw new Error('Failed to create card');
      
      // Reset form and refresh cards
      setNewCard({
        type: 'text',
        content: { text: '', mediaUrl: '' },
        title: '',
        tags: '',
      });
      fetchCards();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
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
      
      const response = await fetch(`/api/v1/cards/${editedCard[CARD_FIELDS.UUID]}`, {
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
      });

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
      
      const response = await fetch(`/api/v1/cards/${uuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [CARD_FIELDS.IS_ACTIVE]: !isActive }),
      });

      if (!response.ok) throw new Error('Failed to update card');
      fetchCards();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-100 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Card Management</h1>
          <button
            onClick={async () => {
              if (!confirm('Are you sure you want to reset the database? This will delete ALL cards, sessions, and progress data.')) return;
              
              try {
                const response = await fetch('/api/v1/reset', {
                  method: 'POST',
                });
                
                if (!response.ok) throw new Error('Failed to reset database');
                
                // Refresh the cards list
                fetchCards();
                setError(null);
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                setError(errorMessage);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reset Database
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={newCard.type}
                onChange={(e) => setNewCard({ ...newCard, type: e.target.value as 'text' | 'media' })}
                className="w-full p-2 border rounded"
              >
                <option value="text">Text</option>
                <option value="media">Media</option>
              </select>
            </div>

            {newCard.type === 'text' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Text Content
                </label>
                <textarea
                  value={newCard.content.text}
                  onChange={(e) => setNewCard({
                    ...newCard,
                    content: { ...newCard.content, text: e.target.value }
                  })}
                  className="w-full p-2 border rounded"
                  rows={4}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Media URL
                </label>
                <input
                  type="url"
                  value={newCard.content.mediaUrl}
                  onChange={(e) => setNewCard({
                    ...newCard,
                    content: { ...newCard.content, mediaUrl: e.target.value }
                  })}
                  className="w-full p-2 border rounded"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={newCard.title}
                onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={newCard.tags}
                onChange={(e) => setNewCard({ ...newCard, tags: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="tag1, tag2, tag3"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Add Card
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <motion.div
              key={createUniqueKey('card', card[CARD_FIELDS.UUID])}
              layout
              className={`relative group ${
                !card[CARD_FIELDS.IS_ACTIVE] ? 'opacity-50' : ''
              }`}
            >
              {/* BaseCard Display */}
              <BaseCard
                uuid={card[CARD_FIELDS.UUID]}
                type={card[CARD_FIELDS.TYPE] as 'text' | 'media'}
                content={card[CARD_FIELDS.CONTENT]}
                title={card[CARD_FIELDS.TITLE]}
                size="medium"
                className="transition-all duration-200 group-hover:shadow-lg"
              >
                {/* Status indicator */}
                {!card[CARD_FIELDS.IS_ACTIVE] && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    Inactive
                  </div>
                )}
              </BaseCard>

              {/* Card Management Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-75 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => toggleCardStatus(card[CARD_FIELDS.UUID], card[CARD_FIELDS.IS_ACTIVE])}
                    className={`px-3 py-2 rounded text-sm font-medium ${
                      card[CARD_FIELDS.IS_ACTIVE]
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {card[CARD_FIELDS.IS_ACTIVE] ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEdit(card)}
                    className="px-3 py-2 rounded text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(card[CARD_FIELDS.UUID])}
                    className="px-3 py-2 rounded text-sm font-medium bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Card Metadata */}
              <div className="mt-3 space-y-2">
                {/* Tags */}
                {card[CARD_FIELDS.TAGS].length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {card[CARD_FIELDS.TAGS].slice(0, 3).map((tag, tagIndex) => (
                      <span
                        key={createUniqueKey('tag', card[CARD_FIELDS.UUID], tagIndex, tag)}
                        className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {card[CARD_FIELDS.TAGS].length > 3 && (
                      <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                        +{card[CARD_FIELDS.TAGS].length - 3}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Creation Date */}
                <div className="text-xs text-gray-500">
                  Created: {new Date(card[CARD_FIELDS.CREATED_AT]).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>

    {/* Edit Modal */}
    {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Card</h2>
              <button
                onClick={() => {
                  setIsEditing(null);
                  setEditedCard(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={editedCard?.type}
                  onChange={(e) => setEditedCard({ 
                    ...editedCard!, 
                    type: e.target.value as 'text' | 'media',
                    content: e.target.value === 'text' 
                      ? { text: '' } 
                      : { mediaUrl: '' }
                  })}
                  className="w-full p-2 border rounded"
                >
                  <option value="text">Text</option>
                  <option value="media">Media</option>
                </select>
              </div>

              {editedCard?.type === 'text' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text Content
                  </label>
                  <textarea
                    value={editedCard.content.text || ''}
                    onChange={(e) => setEditedCard({
                      ...editedCard,
                      content: { ...editedCard.content, text: e.target.value }
                    })}
                    className="w-full p-2 border rounded"
                    rows={4}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Media URL
                  </label>
                  <input
                    type="url"
                    value={editedCard?.content.mediaUrl || ''}
                    onChange={(e) => setEditedCard({
                      ...editedCard!,
                      content: { ...editedCard!.content, mediaUrl: e.target.value }
                    })}
                    className="w-full p-2 border rounded"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editedCard?.title || ''}
                  onChange={(e) => setEditedCard({ ...editedCard!, title: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  value={Array.isArray(editedCard?.tags) ? editedCard.tags.join(', ') : ''}
                  onChange={(e) => setEditedCard({ 
                    ...editedCard!, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  })}
                  className="w-full p-2 border rounded"
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
                  className="px-4 py-2 text-gray-700 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
    )}
    </>
  );
}
