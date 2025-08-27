'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createUniqueKey, validateUUID } from '@/app/lib/utils/fieldValidation';
import { useOrganization } from '@/app/components/OrganizationProvider';
import PageLayout from '../components/PageLayout'; // Import the new layout

interface Card {
  uuid: string;
  name: string; // #HASHTAG
  body: {
    imageUrl?: string;
    textContent?: string;
    background?: {
      type: 'color' | 'gradient' | 'pattern';
      value: string;
      textColor?: string;
    };
  };
  hashtags: string[]; // Parent relationships
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CardsPage() {
  const router = useRouter();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch cards when organization is loaded and available
    if (!orgLoading && currentOrganization) {
      fetchCards();
    }
  }, [currentOrganization, orgLoading]);

  const fetchCards = async () => {
    if (!currentOrganization) {
      setError('No organization selected');
      setLoading(false);
      return;
    }

    try {
      // Use organization-aware API endpoint by adding organization context to headers
      const response = await fetch('/api/v1/cards', {
        headers: {
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        }
      });
      
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
    router.push(`/card-editor?uuid=${card.uuid}`);
  };

  const handleDelete = async (uuid: string) => {
    if (!validateUUID(uuid)) {
      setError('Invalid card UUID');
      return;
    }
    
    if (!currentOrganization) {
      setError('No organization selected');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    try {
      const response = await fetch(`/api/v1/cards/${uuid}`, {
        method: 'DELETE',
        headers: {
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        }
      });

      if (!response.ok) throw new Error('Failed to delete card');
      fetchCards();
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
      
      if (!currentOrganization) {
        setError('No organization selected');
        return;
      }
      
      const response = await fetch(`/api/v1/cards/${uuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (!response.ok) throw new Error('Failed to update card status');
      fetchCards();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  // Show loading while organization context or cards are loading
  if (orgLoading || loading) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">
          {orgLoading ? 'Loading organization...' : 'Loading cards...'}
        </span>
      </div>
    );
  }

  // Show error if no organization is available
  if (!currentOrganization) {
    return (
      <PageLayout title="Card Management">
        <div className="status-error p-4 mb-4 rounded-lg">
          No organization selected. Please select an organization to view cards.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Card Management">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-1">All Cards</h2>
          <p className="text-sm text-gray-500">
            Organization: {currentOrganization.OrganizationName}
          </p>
        </div>
        <button
          onClick={() => router.push('/card-editor')}
          className="btn btn-primary"
        >
          Create New Card
        </button>
      </div>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">
          {error}
        </div>
      )}

      {cards.length === 0 && !error ? (
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="text-6xl mb-4">📇</div>
            <h3 className="text-xl font-semibold mb-2">No Cards Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start building your card collection by creating your first card!
            </p>
          </div>
          <button
            onClick={() => router.push('/card-editor')}
            className="btn-primary px-6 py-3 text-lg font-medium"
          >
            🎨 Create Your First Card
          </button>
        </div>
      ) : (
        <div className="results-grid">
          {cards.map((card) => (
            <motion.div
              key={createUniqueKey('card', card.uuid)}
              layout
              className={`relative group ${
                !card.isActive ? 'opacity-50' : ''
              }`}
            >
            {/* Card Preview - Display name and basic info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg min-h-[200px] flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-2">{card.name}</h3>
                {card.body?.imageUrl && (
                  <div className="mb-2">
                    <img 
                      src={card.body.imageUrl} 
                      alt={card.name}
                      className="w-full h-32 object-contain rounded"
                      onError={(e) => {
                        // Hide broken images
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {card.body?.textContent && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                    {card.body.textContent}
                  </p>
                )}
              </div>
              {!card.isActive && (
                <div className="absolute top-2 right-2">
                  <span className="status-badge status-error">Inactive</span>
                </div>
              )}
            </div>

            <div className="card-overlay card-overlay-hover rounded-lg">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleCardStatus(card.uuid, card.isActive)}
                  className={`btn btn-sm ${
                    card.isActive
                      ? 'btn-danger'
                      : 'btn-success'
                  }`}
                >
                  {card.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleEdit(card)}
                  className="btn btn-sm btn-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(card.uuid)}
                  className="btn btn-sm btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {card.hashtags && card.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {card.hashtags.slice(0, 3).map((hashtag, tagIndex) => (
                    <span
                      key={createUniqueKey('hashtag', card.uuid, tagIndex, hashtag)}
                      className="status-badge status-info"
                    >
                      {hashtag}
                    </span>
                  ))}
                  {card.hashtags.length > 3 && (
                    <span className="status-badge status-info">
                      +{card.hashtags.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              <div className="text-xs text-muted">
                Created: {new Date(card.createdAt).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        ))}
        </div>
      )}
    </PageLayout>
  );
}
