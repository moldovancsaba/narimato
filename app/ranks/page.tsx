'use client';

import { useEffect, useState } from 'react';
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

export default function RanksPage() {
  const [ranking, setRanking] = useState<RankedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGlobalRanks = async () => {
      try {
        const response = await fetch('/api/v1/global-rankings');
        if (!response.ok) {
          throw new Error('Failed to fetch global rankings');
        }
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          setRanking(data.rankings);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalRanks();
  }, []);

  if (loading) {
    return (
      <PageLayout title="Global Rankings">
        <div className="flex justify-center items-center">
          <div className="loading-spinner"></div>
          <span className="ml-2 text-lg">Loading Global Rankings...</span>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Error">
        <div className="status-error p-4 rounded-lg">{error}</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Global Rankings">
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Global Rankings (ELO-Based)</h2>
        <p className="text-sm text-muted mb-4">
          Rankings are calculated using the ELO rating system, providing skill-based comparisons across all user sessions. 
          ELO rating provides more accurate rankings than simple win counts.
        </p>
      </div>
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
                </div>
              </div>
            </BaseCard>
          </motion.div>
        ))}
      </div>
    </PageLayout>
  );
}

