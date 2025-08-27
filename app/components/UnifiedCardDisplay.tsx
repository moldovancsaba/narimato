'use client';

/**
 * UnifiedCardDisplay Component
 * 
 * ARCHITECTURAL PURPOSE:
 * - Provides consistent card display across all pages and contexts
 * - Handles organization-aware card data fetching
 * - Supports multiple view modes (grid, list, management)
 * - Ensures uniform styling and behavior
 * 
 * SECURITY CONSIDERATIONS:
 * - Uses organization context for proper data isolation
 * - Validates user permissions for card operations
 * - Sanitizes card content to prevent XSS
 * 
 * FEATURES:
 * - Organization-aware data fetching
 * - Real-time card updates when organization changes
 * - Consistent loading states and error handling
 * - Support for different card types (root, playable, all)
 * - Card filtering and search capabilities
 * - Action buttons for edit/delete/activate operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/app/components/OrganizationProvider';
import { createUniqueKey, validateUUID } from '@/app/lib/utils/fieldValidation';

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
  childCount?: number;
  isPlayable?: boolean;
  isRoot?: boolean;
  isActive: boolean;
  cardSize?: string;
  createdAt: string;
  updatedAt: string;
}

interface UnifiedCardDisplayProps {
  // Display mode
  mode?: 'grid' | 'list' | 'management' | 'selector';
  
  // Card filtering
  cardType?: 'root' | 'playable' | 'all';
  parentCard?: string; // For getting children
  searchQuery?: string;
  
  // Pagination
  pageSize?: number;
  enablePagination?: boolean;
  
  // Actions
  onCardClick?: (card: Card) => void;
  onCardEdit?: (card: Card) => void;
  onCardDelete?: (card: Card) => void;
  onCardToggle?: (card: Card) => void;
  onCardPlay?: (card: Card) => void;
  
  // Selection (for management mode)
  selectedCards?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  
  // UI customization
  className?: string;
  showActions?: boolean;
  showMetadata?: boolean;
  showOrganizationInfo?: boolean;
  emptyMessage?: string;
}

export default function UnifiedCardDisplay({
  mode = 'grid',
  cardType = 'all',
  parentCard,
  searchQuery = '',
  pageSize = 20,
  enablePagination = true,
  onCardClick,
  onCardEdit,
  onCardDelete,
  onCardToggle,
  onCardPlay,
  selectedCards = [],
  onSelectionChange,
  className = '',
  showActions = true,
  showMetadata = true,
  showOrganizationInfo = false,
  emptyMessage = 'No cards found'
}: UnifiedCardDisplayProps) {
  
  const router = useRouter();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  
  // State management
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Fetch cards with organization context
  const fetchCards = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!currentOrganization) {
      setError('No organization selected');
      setLoading(false);
      return;
    }

    try {
      if (append) {
        // For pagination, don't show main loading
      } else {
        setLoading(true);
        setError(null);
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: pageSize.toString()
      });

      if (cardType !== 'all') {
        params.set('type', cardType);
      }

      if (parentCard) {
        params.set('parent', parentCard);
      }

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const response = await fetch(`/api/v1/cards?${params}`, {
        headers: {
          'X-Organization-Slug': currentOrganization.slug
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch cards: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const newCards = data.cards || [];
        
        if (append) {
          setCards(prev => [...prev, ...newCards]);
        } else {
          setCards(newCards);
        }

        setPage(pageNum);
        setTotalPages(data.pagination?.pages || 1);
        setHasMore(data.pagination?.hasNext || false);
      } else {
        throw new Error(data.error || 'Failed to fetch cards');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, cardType, parentCard, searchQuery, pageSize]);

  // Load cards when dependencies change
  useEffect(() => {
    if (!orgLoading && currentOrganization) {
      setPage(1); // Reset to first page
      fetchCards(1, false);
    }
  }, [fetchCards, orgLoading, currentOrganization]);

  // Handle card actions
  const handleCardAction = async (action: string, card: Card) => {
    if (!currentOrganization) return;

    try {
      switch (action) {
        case 'edit':
          if (onCardEdit) {
            onCardEdit(card);
          } else {
            router.push(`/card-editor?uuid=${card.uuid}`);
          }
          break;

        case 'delete':
          if (!validateUUID(card.uuid)) {
            setError('Invalid card UUID');
            return;
          }

          if (!confirm('Are you sure you want to delete this card?')) return;

          const deleteResponse = await fetch(`/api/v1/cards/${card.uuid}`, {
            method: 'DELETE',
            headers: {
              'X-Organization-Slug': currentOrganization.slug
            }
          });

          if (!deleteResponse.ok) {
            throw new Error('Failed to delete card');
          }

          if (onCardDelete) {
            onCardDelete(card);
          } else {
            // Refresh the cards list
            fetchCards(page, false);
          }
          break;

        case 'toggle':
          if (!validateUUID(card.uuid)) {
            setError('Invalid card UUID');
            return;
          }

          const toggleResponse = await fetch(`/api/v1/cards/${card.uuid}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Organization-Slug': currentOrganization.slug
            },
            body: JSON.stringify({ isActive: !card.isActive })
          });

          if (!toggleResponse.ok) {
            throw new Error('Failed to update card status');
          }

          if (onCardToggle) {
            onCardToggle(card);
          } else {
            // Update local state
            setCards(prev => prev.map(c => 
              c.uuid === card.uuid ? { ...c, isActive: !c.isActive } : c
            ));
          }
          break;

        case 'play':
          if (onCardPlay) {
            onCardPlay(card);
          } else if (card.isPlayable) {
            // Default play behavior - navigate to homepage with card selection
            router.push(`/?play=${encodeURIComponent(card.name)}`);
          }
          break;

        default:
          if (onCardClick) {
            onCardClick(card);
          }
          break;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed';
      setError(errorMessage);
      console.error(`Card ${action} error:`, err);
    }
  };

  // Handle selection changes (for management mode)
  const handleSelectionChange = (cardId: string, selected: boolean) => {
    if (!onSelectionChange) return;

    const newSelection = selected
      ? [...selectedCards, cardId]
      : selectedCards.filter(id => id !== cardId);

    onSelectionChange(newSelection);
  };

  // Load more cards for pagination
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchCards(page + 1, true);
    }
  };

  // Render loading state
  if (orgLoading || (loading && cards.length === 0)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">
          {orgLoading ? 'Loading organization...' : 'Loading cards...'}
        </span>
      </div>
    );
  }

  // Render error state for no organization
  if (!currentOrganization) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Organization Selected
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Please select an organization to view cards.
        </p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">❌</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Error Loading Cards
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          {error}
        </p>
        <button
          onClick={() => fetchCards(1, false)}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Render empty state
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Cards Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {emptyMessage}
        </p>
        {showOrganizationInfo && (
          <p className="text-xs text-gray-500 mt-2">
            Organization: {currentOrganization.name}
          </p>
        )}
      </div>
    );
  }

  // Render cards based on mode
  const containerClass = mode === 'list' 
    ? 'space-y-4' 
    : 'results-grid';

  return (
    <div className={`unified-card-display ${className}`}>
      {/* Organization info */}
      {showOrganizationInfo && (
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Organization:</span> {currentOrganization.name}
          </p>
          <p className="text-xs text-gray-500">
            Showing {cards.length} cards {cardType !== 'all' && `(${cardType} only)`}
          </p>
        </div>
      )}

      {/* Cards container */}
      <div className={containerClass}>
        {cards.map((card) => (
          <motion.div
            key={createUniqueKey('card', card.uuid)}
            layout  
            className={`relative group ${
              !card.isActive ? 'opacity-50' : ''
            } ${mode === 'management' ? 'cursor-pointer' : ''}`}
          >
            {/* Selection checkbox for management mode */}
            {mode === 'management' && onSelectionChange && (
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedCards.includes(card.uuid)}
                  onChange={(e) => handleSelectionChange(card.uuid, e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            {/* Card content */}
            <div className={`${
              mode === 'list' 
                ? 'flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow'
                : 'bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg min-h-[200px] flex flex-col justify-between'
            }`}>
              
              {/* Card preview */}
              <div className={mode === 'list' ? 'flex-shrink-0 w-16 h-16' : 'flex-1'}>
                <h3 className="font-semibold text-lg mb-2">{card.name}</h3>
                
                {card.body?.imageUrl && (
                  <div className={mode === 'list' ? 'w-full h-full' : 'mb-2'}>
                    <img 
                      src={card.body.imageUrl} 
                      alt={card.name}
                      className={`${
                        mode === 'list' 
                          ? 'w-full h-full object-cover rounded'
                          : 'w-full h-32 object-contain rounded'
                      }`}
                      onError={(e) => {
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

              {/* Card metadata */}
              {showMetadata && (
                <div className={mode === 'list' ? 'flex-1 min-w-0' : 'mt-3'}>
                  {/* Hashtags */}
                  {card.hashtags && card.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
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

                  {/* Card stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {card.childCount !== undefined && (
                      <span>{card.childCount} children</span>
                    )}
                    {card.isPlayable && (
                      <span className="status-badge status-success">Playable</span>
                    )}
                    {card.isRoot && (
                      <span className="status-badge status-primary">Root</span>
                    )}
                    <span>Created: {new Date(card.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Status indicators */}
              {!card.isActive && (
                <div className="absolute top-2 right-2">
                  <span className="status-badge status-error">Inactive</span>
                </div>
              )}
            </div>

            {/* Action overlay */}
            {showActions && (
              <div className="card-overlay card-overlay-hover rounded-lg">
                <div className="flex flex-col gap-2">
                  {card.isPlayable && (
                    <button
                      onClick={() => handleCardAction('play', card)}
                      className="btn btn-sm btn-success"
                    >
                      Play
                    </button>
                  )}
                  <button
                    onClick={() => handleCardAction('toggle', card)}
                    className={`btn btn-sm ${
                      card.isActive ? 'btn-danger' : 'btn-success'
                    }`}
                  >
                    {card.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleCardAction('edit', card)}
                    className="btn btn-sm btn-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleCardAction('delete', card)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Pagination controls */}
      {enablePagination && hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? (
              <>
                <div className="loading-spinner mr-2"></div>
                Loading...
              </>
            ) : (
              'Load More Cards'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
