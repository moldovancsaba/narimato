'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import DeckCard from '@/app/components/DeckCard';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { useOrgFromUrl } from '@/app/hooks/useOrgFromUrl';

interface Card {
  uuid: string;
  name: string;
  displayName: string;
  imageUrl?: string;
  cardSize?: string;
  type: 'deck' | 'card';
  childCount?: number;
  hashtags?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type SortOption = 'name' | 'created' | 'updated' | 'type';
type FilterOption = 'all' | 'cards' | 'decks' | 'active' | 'inactive';

export default function OrganizationCardsPage() {
  const router = useRouter();
  const { organization, isLoading: orgLoading, error: orgError, slug } = useOrgFromUrl();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // CRUD state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  useEffect(() => {
    // Only fetch cards when organization is loaded
    if (!orgLoading && organization) {
      fetchCards();
    }
  }, [organization, orgLoading]);

  const fetchCards = async () => {
    if (!organization) {
      setError('No organization available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`📋 Fetching all cards for organization: ${organization.OrganizationName}`);
      
      const response = await fetch('/api/v1/cards', {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cards: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        const mappedCards = (data.cards || []).map((card: any) => ({
          uuid: card.uuid,
          name: card.name,
          displayName: card.body?.textContent || card.name,
          imageUrl: card.body?.imageUrl,
          cardSize: card.cardSize,
          type: card.name.startsWith('#') ? 'deck' : 'card',
          childCount: card.childCount || 0,
        }));
        setCards(mappedCards);
        console.log(`✅ Loaded ${mappedCards.length} cards`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('❌ Error fetching cards:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted cards
  const filteredAndSortedCards = useMemo(() => {
    let filtered = cards;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card => 
        card.name.toLowerCase().includes(query) ||
        card.displayName.toLowerCase().includes(query) ||
        (card.hashtags && card.hashtags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    // Apply type/status filter
    switch (filterBy) {
      case 'cards':
        filtered = filtered.filter(card => card.type === 'card');
        break;
      case 'decks':
        filtered = filtered.filter(card => card.type === 'deck');
        break;
      case 'active':
        filtered = filtered.filter(card => card.isActive !== false);
        break;
      case 'inactive':
        filtered = filtered.filter(card => card.isActive === false);
        break;
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'updated':
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [cards, searchQuery, filterBy, sortBy]);

  const handleCardSelect = (card: Card) => {
    if (isSelectionMode) {
      const newSelection = new Set(selectedCards);
      if (newSelection.has(card.uuid)) {
        newSelection.delete(card.uuid);
      } else {
        newSelection.add(card.uuid);
      }
      setSelectedCards(newSelection);
    } else {
      // Normal mode - navigate to editor
      router.push(`/organization/${slug}/card-editor?edit=${card.uuid}`);
    }
  };

  const handleBulkAction = async (action: 'delete' | 'activate' | 'deactivate') => {
    if (selectedCards.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to ${action} ${selectedCards.size} selected cards?`);
    if (!confirmed) return;
    
    // TODO: Implement bulk actions API calls
    console.log(`Bulk ${action} for cards:`, Array.from(selectedCards));
    
    // Reset selection
    setSelectedCards(new Set());
    setIsSelectionMode(false);
  };

  const toggleSelectAll = () => {
    if (selectedCards.size === filteredAndSortedCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(filteredAndSortedCards.map(card => card.uuid)));
    }
  };

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <PageLayout title="Cards">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading organization..." />
        </div>
      </PageLayout>
    );
  }

  // Show organization error
  if (orgError || !organization) {
    return (
      <PageLayout title="Cards">
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Organization Not Found</h3>
          <p>{orgError || 'The requested organization could not be found or is inactive.'}</p>
          {slug && (
            <p className="text-sm mt-2 opacity-75">
              Slug: <code>{slug}</code>
            </p>
          )}
        </div>
      </PageLayout>
    );
  }

  // Show cards loading
  if (loading) {
    return (
      <PageLayout title="Cards">
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" message="Loading cards..." />
        </div>
      </PageLayout>
    );
  }

  // Show cards error
  if (error) {
    return (
      <PageLayout title="Cards">
        <div className="status-error p-4 rounded-lg max-w-md mx-auto mt-8">
          <h3 className="font-semibold mb-2">Error Loading Cards</h3>
          <p>{error}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Cards">
      <div className="w-full h-full flex flex-col gap-6 p-6">
        
        {/* Organization Header */}
        <div className="content-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">All Cards</h1>
              <p className="text-muted">{organization.OrganizationName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push(`/organization/${slug}/ranks`)}
                className="btn btn-secondary btn-sm"
              >
                🏆 View Rankings
              </button>
              <button 
                onClick={() => router.push(`/organization/${slug}/card-editor`)}
                className="btn btn-outline btn-sm"
              >
                ➕ Create New Card
              </button>
            </div>
          </div>
          
          <div className="text-with-background">
            <h2 className="text-xl font-semibold mb-2">Browse All Cards and Decks</h2>
            <p className="text-sm text-muted">
              Manage all cards and decks in <strong>{organization.OrganizationName}</strong>. 
              Click on any card or deck to edit it. Use this page for creating, updating, and organizing your content.
            </p>
          </div>
        </div>
        
        {/* CRUD Controls */}
        {cards.length > 0 && (
          <div className="content-background p-4">
            {/* Search and Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search cards, decks, or hashtags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🔍</span>
                  </div>
                </div>
              </div>
              
              {/* Filter Dropdown */}
              <div className="flex gap-2">
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                  className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">All Items</option>
                  <option value="cards">Cards Only</option>
                  <option value="decks">Decks Only</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                
                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="created">Sort by Created</option>
                  <option value="updated">Sort by Updated</option>
                  <option value="type">Sort by Type</option>
                </select>
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              {/* Selection Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  className={`btn btn-sm ${isSelectionMode ? 'btn-accent' : 'btn-secondary'}`}
                >
                  {isSelectionMode ? '✅ Select Mode' : '☐ Select Mode'}
                </button>
                
                {isSelectionMode && (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="btn btn-sm btn-secondary"
                    >
                      {selectedCards.size === filteredAndSortedCards.length ? 'Deselect All' : 'Select All'}
                    </button>
                    
                    {selectedCards.size > 0 && (
                      <span className="text-sm text-cyan-400 font-medium">
                        {selectedCards.size} selected
                      </span>
                    )}
                  </>
                )}
              </div>
              
              {/* Results Count */}
              <div className="text-sm text-gray-400">
                {filteredAndSortedCards.length} of {cards.length} items
                {searchQuery && (
                  <span className="ml-2 text-cyan-400">filtered by: "{searchQuery}"</span>
                )}
              </div>
            </div>
            
            {/* Bulk Actions (only visible when items are selected) */}
            {selectedCards.size > 0 && (
              <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-cyan-500">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">
                    {selectedCards.size} items selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkAction('activate')}
                      className="btn btn-sm btn-success"
                    >
                      ✅ Activate
                    </button>
                    <button
                      onClick={() => handleBulkAction('deactivate')}
                      className="btn btn-sm btn-secondary"
                    >
                      ⏸️ Deactivate
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="btn btn-sm btn-danger"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      
        {/* Content Area */}
        <div className="flex-1 content-background p-6">
          {cards.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">🎮</div>
                <h3 className="text-xl font-semibold mb-2">No Cards Available</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-6">
                    Create your first cards to start ranking and playing!
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/organization/${slug}/card-editor`)}
                  className="btn btn-primary px-6 py-3 text-lg font-medium"
                >
                  ✏️ Create Your First Cards
                </button>
              </div>
            </div>
          ) : filteredAndSortedCards.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">No matches found</h3>
                <div className="text-with-background max-w-md mx-auto">
                  <p className="text-muted mb-6">
                    No cards match your current search and filter criteria.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterBy('all');
                }}
                className="btn btn-secondary"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="results-grid">
              {filteredAndSortedCards.map((card) => {
                const isSelected = selectedCards.has(card.uuid);
                return (
                  <div 
                    key={card.uuid} 
                    className={`relative cursor-pointer transition-all duration-200 ${
                      isSelectionMode ? 'hover:scale-105' : ''
                    } ${
                      isSelected ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-gray-900' : ''
                    }`}
                  >
                    <DeckCard
                      tag={card.name}
                      displayName={card.displayName}
                      cardCount={card.childCount}
                      onClick={() => handleCardSelect(card)}
                      showRankingsIcon={false}
                      imageUrl={card.imageUrl}
                      cardSize={card.cardSize}
                    />
                    
                    {/* Selection Checkbox */}
                    {isSelectionMode && (
                      <div className="absolute top-2 left-2 z-30">
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          isSelected 
                            ? 'bg-cyan-500 border-cyan-500' 
                            : 'bg-gray-800 border-gray-600'
                        }`}>
                          {isSelected && (
                            <span className="text-white text-sm font-bold">✓</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Type Badge */}
                    <div className="absolute top-2 right-2 z-20">
                      {card.type === 'deck' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{
                          backgroundColor: 'var(--primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--accent)'
                        }}>
                          🎮 Deck
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{
                          backgroundColor: 'var(--success)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--success-hover)'
                        }}>
                          🎴 Card
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="text-center mt-8">
            <div className="text-with-background">
              <p className="text-sm text-muted">
                Play sessions contribute to global rankings updated in real-time
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
