'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOrganization } from '@/app/components/OrganizationProvider';

interface Card {
  uuid: string;
  text: string;
  mediaUrl?: string;
  type: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
}

interface CardManagementProps {
  deckHashtag: string;
}

export default function CardManagement({ deckHashtag }: CardManagementProps) {
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [updatingCards, setUpdatingCards] = useState<Set<string>>(new Set());

  // Get the hashtag without the # symbol for tag matching
  const hashtagWithoutSymbol = deckHashtag.replace('#', '');

  const loadCards = useCallback(async (pageNum: number = 1, searchTerm: string = '', append: boolean = false) => {
    if (!currentOrganization) {
      console.warn('No organization available for loading cards');
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        search: searchTerm,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      const response = await fetch(`/api/v1/cards?${params}`, {
        headers: {
          'X-Organization-UUID': currentOrganization.OrganizationUUID
        }
      });
      const data = await response.json();

      if (data.success) {
        if (append) {
          setCards(prev => [...prev, ...data.cards]);
        } else {
          setCards(data.cards);
        }
        setHasMore(data.pagination.hasNext);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    // Only load cards when organization is available and not loading
    if (!orgLoading && currentOrganization) {
      loadCards(1, search);
    }
  }, [search, loadCards, currentOrganization, orgLoading]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadCards(page + 1, search, true);
    }
  };

  const handleToggleCard = async (card: Card) => {
    const cardId = card.uuid;
    setUpdatingCards(prev => new Set(prev).add(cardId));

    try {
      const isInDeck = card.tags.includes(hashtagWithoutSymbol) || card.text.includes(deckHashtag);
      
      let updatedTags = [...card.tags];
      let updatedText = card.text;

      if (isInDeck) {
        // Remove from deck
        updatedTags = updatedTags.filter(tag => tag !== hashtagWithoutSymbol);
        // Also remove hashtag from text if it exists
        updatedText = updatedText.replace(new RegExp(deckHashtag, 'gi'), '').replace(/\s+/g, ' ').trim();
      } else {
        // Add to deck
        if (!updatedTags.includes(hashtagWithoutSymbol)) {
          updatedTags.push(hashtagWithoutSymbol);
        }
        // Optionally add hashtag to text if not present
        if (!updatedText.includes(deckHashtag)) {
          updatedText = `${updatedText} ${deckHashtag}`.trim();
        }
      }

      const response = await fetch(`/api/v1/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-Organization-UUID': currentOrganization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify({
          hashtags: updatedTags,
          body: {
            textContent: updatedText
          }
        })
      });

      if (response.ok) {
        // Update local state
        setCards(prev => prev.map(c => 
          c.uuid === cardId 
            ? { ...c, tags: updatedTags, text: updatedText }
            : c
        ));
      }
    } catch (error) {
      console.error('Error updating card:', error);
    } finally {
      setUpdatingCards(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const isCardInDeck = (card: Card) => {
    return card.tags.includes(hashtagWithoutSymbol) || card.text.includes(deckHashtag);
  };

  const getCardPreview = (card: Card) => {
    if (card.mediaUrl) {
      return (
        <img
          src={card.mediaUrl}
          alt={card.text}
          className="w-full h-24 object-contain rounded"
        />
      );
    }
    
    return (
      <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400 text-xs text-center p-2 line-clamp-3">
          {card.text}
        </span>
      </div>
    );
  };

  // Show loading while organization context or cards are loading
  if (orgLoading || loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">
          {orgLoading ? 'Loading organization...' : 'Loading cards...'}
        </p>
      </div>
    );
  }

  // Show error if no organization is available
  if (!currentOrganization) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Organization Selected
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Please select an organization to manage cards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search cards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {cards.filter(isCardInDeck).length} cards in this deck of {cards.length} total
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
        {cards.map((card) => {
          const inDeck = isCardInDeck(card);
          const isUpdating = updatingCards.has(card.uuid);
          
          return (
            <motion.div
              key={card.uuid}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                inDeck 
                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {/* Checkbox */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleToggleCard(card)}
                  disabled={isUpdating}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    inDeck
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                  }`}
                >
                  {isUpdating ? (
                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                  ) : inDeck ? (
                    '✓'
                  ) : null}
                </button>
              </div>

              {/* Preview */}
              <div className="flex-shrink-0 w-16">
                {getCardPreview(card)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                  {card.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {card.type}
                  </span>
                  {card.tags.length > 0 && (
                    <div className="flex gap-1">
                      {card.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className={`text-xs px-1 rounded ${
                            tag === hashtagWithoutSymbol
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                      {card.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{card.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                <span className={`text-xs font-medium ${
                  inDeck 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-500 dark:text-gray-500'
                }`}>
                  {inDeck ? 'In Deck' : 'Not in Deck'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium py-2 px-4 rounded transition-colors flex items-center gap-2 mx-auto"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                Loading...
              </>
            ) : (
              'Load More Cards'
            )}
          </button>
        </div>
      )}

      {/* Empty State */}
      {cards.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📝</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No cards found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {search ? 'Try adjusting your search criteria' : 'Create some cards first to manage deck associations'}
          </p>
        </div>
      )}
    </div>
  );
}
