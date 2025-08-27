'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from './OrganizationProvider';
import PageLayout from './PageLayout';
import DeckCard from './DeckCard';

interface PlayableCard {
  uuid: string;
  hashtag: string;
  slug: string;
  title: string;
  description: string;
  cardCount: number;
  isActive: boolean;
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  cardSize?: string;
  styling?: {
    textColor: string;
    backgroundColor: string;
    textAlign: string;
  };
}

interface OrganizationMainPageProps {
  organization: any;
  isOrgSpecific: boolean;
  slug?: string; // Organization slug for URL construction
}

export default function OrganizationMainPage({ organization, isOrgSpecific, slug }: OrganizationMainPageProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [playableCards, setPlayableCards] = useState<PlayableCard[]>([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      fetchPlayableCards();
    }
  }, [organization]);

  const fetchPlayableCards = async () => {
    if (!organization) {
      setError('No organization selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/v1/cards?type=playable', {
        headers: {
          'X-Organization-UUID': organization.OrganizationUUID
        }
      });
        
      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }
        
      const data = await response.json();
        
      const mappedCards = (data.cards || []).map((card: any) => ({
        uuid: card.uuid,
        hashtag: card.name,
        slug: card.name.substring(1).toLowerCase(),
        title: card.body?.textContent || card.name.substring(1),
        description: card.body?.textContent || `${card.name.substring(1)} category`,
        cardCount: card.childCount || 0,
        isActive: card.isActive,
        publicUrl: null,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        imageUrl: card.body?.imageUrl,
        cardSize: card.cardSize,
        styling: card.body?.background ? {
          textColor: card.body.background.textColor || '#ffffff',
          backgroundColor: card.body.background.value || '#667eea',
          textAlign: 'center'
        } : undefined
      }));
        
      setPlayableCards(mappedCards);
    } catch (error) {
      console.error('Error fetching cards:', error);
      setError('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (selectedTag: string) => {
    if (isStarting) return;
    
    setIsStarting(true);
    setSelectedCard(selectedTag);
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sessionUUID');
        localStorage.removeItem('lastState');
      }
      
      let browserSessionId = null;
      if (typeof window !== 'undefined') {
        browserSessionId = localStorage.getItem('browserSessionId');
        if (!browserSessionId) {
          browserSessionId = crypto.randomUUID();
          localStorage.setItem('browserSessionId', browserSessionId);
        }
      }
      
      const response = await fetch('/api/v1/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-UUID': organization?.OrganizationUUID || 'default'
        },
        body: JSON.stringify({ 
          deckTag: selectedTag,
          sessionUUID: browserSessionId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create play');
      }
      
      const playData = await response.json();
      
      if (typeof window !== 'undefined' && playData.playUuid) {
        localStorage.setItem('sessionUUID', playData.playUuid);
      }
      
      // Navigate to organization-specific swipe page if slug is provided
      if (isOrgSpecific && slug) {
        router.push(`/organization/${slug}/swipe?session=${playData.playUuid}`);
      } else {
        router.push('/swipe');
      }
    } catch (error) {
      console.error('Failed to start play:', error);
      setError('Failed to start play');
      setIsStarting(false);
      setSelectedCard('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center page-height">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading cards...</span>
      </div>
    );
  }

  return (
    <PageLayout title={isOrgSpecific ? organization.OrganizationName : "NARIMATO"}>
      <div className="mb-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-lg sm:text-xl leading-relaxed text-balance text-gray-300 dark:text-gray-400">
            Create your personal ranking through simple swipes and votes.
            Your preferences contribute to global ELO-based rankings.
          </p>
        </div>
        
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">Choose a Category</h2>
          <p className="text-sm text-gray-500 mt-1">
            Organization: {organization.OrganizationName}
          </p>
        </div>
      </div>

      {error && (
        <div className="status-error p-4 mb-4 rounded-lg">
          {error}
        </div>
      )}

      {playableCards.length === 0 && !error ? (
        <div className="text-center py-12">
          <div className="mb-6">
            <div className="text-6xl mb-4">🎴</div>
            <h3 className="text-xl font-semibold mb-2">No Playable Cards Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              This organization has no playable cards yet. Check back later!
            </p>
          </div>
        </div>
      ) : (
        <div className="results-grid">
          {playableCards.map((card) => (
            <DeckCard
              key={card.uuid}
              tag={card.hashtag}
              displayName={card.title}
              cardCount={card.cardCount}
              onClick={() => handleStart(card.hashtag)}
              isLoading={isStarting && card.hashtag === selectedCard}
              imageUrl={card.imageUrl}
              cardSize={card.cardSize}
            />
          ))}
        </div>
      )}

      <div className="text-center mt-8">
        <p className="text-sm text-balance text-gray-400 dark:text-gray-500">
          No registration required • Your rankings are private
        </p>
      </div>
    </PageLayout>
  );
}
