'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageLayout from '@/app/components/PageLayout';
import BaseCard from '@/app/components/BaseCard';
import { motion } from 'framer-motion';

interface RankedCard {
  card: {
    uuid: string;
    type: 'text' | 'media';
    content: {
      text?: string;
      mediaUrl?: string;
    };
  };
  rank: number;
  eloRating: number; // ELO rating score - primary ranking metric
  wins: number; // Number of wins in head-to-head comparisons
  losses: number; // Number of losses in head-to-head comparisons
  totalGames: number; // Total number of games played
  winRate: number; // Win rate as a decimal (0.0 to 1.0)
  // Legacy fields maintained for compatibility
  totalScore: number;
  averageRank: number;
  appearanceCount: number;
}

export default function DeckRankingsPage() {
  const params = useParams();
  const router = useRouter();
  const deckTag = params.deck as string;
  
  const [ranking, setRanking] = useState<RankedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeckRankings = async () => {
      try {
        console.log('Fetching deck rankings for:', deckTag);
        
        // Add cache busting and explicit headers for mobile browsers
        const response = await fetch(`/api/v1/global-rankings?deck=${encodeURIComponent(deckTag)}&_t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        console.log('Response status:', response.status);
        console.log('Response URL:', response.url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          throw new Error(`Failed to fetch deck rankings: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.error) {
          setError(data.error);
        } else {
          setRanking(data.rankings);
          if (data.message) {
            setMessage(data.message);
          }
        }
      } catch (err) {
        console.error('Error fetching deck rankings:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (deckTag) {
      fetchDeckRankings();
    }
  }, [deckTag]);

  const handleBackToDecks = () => {
    router.push('/ranks');
  };

  if (loading) {
    return (
      <PageLayout title={`#${deckTag} Rankings`}>
        <div className="flex justify-center items-center">
          <div className="loading-spinner"></div>
          <span className="ml-2 text-lg">Loading Rankings...</span>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Error">
        <div className="text-center">
          <div className="status-error p-4 rounded-lg mb-4">{error}</div>
          <button
            onClick={handleBackToDecks}
            className="btn btn-primary"
          >
            ← Back to Decks
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`#${deckTag} Rankings`}>
      <div className="mb-8">
        <p className="text-sm text-muted mb-4">
          Rankings for cards in the #{deckTag} deck, calculated using the ELO rating system 
          based on head-to-head comparisons across all user sessions.
        </p>
      </div>
      
      {message && ranking.length === 0 ? (
        <div className="text-center p-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-4">
            <p className="text-blue-400">{message}</p>
          </div>
          <button
            onClick={handleBackToDecks}
            className="btn btn-primary"
          >
            Choose Another Deck
          </button>
        </div>
      ) : (
        <>
          
          <div className="results-grid">
            {ranking.map((item) => (
              <motion.div
                key={item.card.uuid}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <BaseCard
                  uuid={item.card.uuid}
                  type={item.card.type}
                  content={item.card.content}
                  size="medium"
                >
                  <div className="absolute -top-2 -left-2 z-20">
                    <div className="ranking-position">#{item.rank}</div>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 z-10 p-2 bg-black/50 rounded-b-lg text-white text-xs">
                    <div className="flex justify-between items-center">
                      <span>ELO: {item.eloRating || 1000}</span>
                      <span>Games: {item.totalGames || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span>Win Rate: {item.winRate ? (item.winRate * 100).toFixed(1) : '0.0'}%</span>
                      <span>{item.wins || 0}W - {item.losses || 0}L</span>
                    </div>
                  </div>
                </BaseCard>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </PageLayout>
  );
}
