'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import BaseCard from '@/app/components/BaseCard';
import PageLayout from '../components/PageLayout';

export default function CompletedPage() {
  const router = useRouter();
  const [ranking, setRanking] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionId = localStorage.getItem(SESSION_FIELDS.ID);
      if (sessionId) {
        fetch(`/api/v1/session/results?sessionId=${sessionId}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.error) {
              setError(data.error);
            } else {
              setRanking(data.personalRanking || []);
              setStatistics(data.statistics || {});
            }
            setLoading(false);
          })
          .catch(() => {
            setError('Failed to load session results.');
            setLoading(false);
          });
      }
      sessionStorage.clear();
      localStorage.removeItem(SESSION_FIELDS.ID);
      localStorage.removeItem('lastState');
      localStorage.removeItem('sessionVersion');
      localStorage.removeItem('deckState');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <PageLayout title="Error">
        <div className="status-error p-4 rounded-lg">{error}</div>
        <div className="mt-8 flex justify-center">
          <button onClick={() => router.push('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout title="Ranking">
      {statistics && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Session Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="statistic-card">
                <div className="text-2xl font-bold text-primary">{statistics.totalCards}</div>
                <div className="text-sm text-muted">Total Cards</div>
              </div>
              <div className="statistic-card">
                <div className="text-2xl font-bold text-success">{statistics.cardsRanked}</div>
                <div className="text-sm text-muted">Cards Ranked</div>
              </div>
              <div className="statistic-card">
                <div className="text-2xl font-bold text-danger">{statistics.cardsDiscarded}</div>
                <div className="text-sm text-muted">Cards Discarded</div>
              </div>
              <div className="statistic-card">
                <div className="text-2xl font-bold text-primary">{statistics.totalSwipes}</div>
                <div className="text-sm text-muted">Total Swipes</div>
              </div>
              <div className="statistic-card">
                <div className="text-2xl font-bold text-primary">{statistics.totalVotes}</div>
                <div className="text-sm text-muted">Total Votes</div>
              </div>
              <div className="statistic-card">
                <div className="text-2xl font-bold text-success">{statistics.completionRate}%</div>
                <div className="text-sm text-muted">Completion Rate</div>
              </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Personal Ranking</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {ranking.map((item) => (
            <div key={item.cardId} className="relative">
              <BaseCard
                uuid={item.cardId}
                type={item.card.type}
                content={item.card.content}
                size="medium"
                className="transition-transform duration-200"
              >
                <div className="absolute -top-2 -left-2 z-20">
                  <div className="ranking-position">#{item.rank}</div>
                </div>
              </BaseCard>
            </div>
          ))}
        </div>
      </div>

    </PageLayout>
  );
}
