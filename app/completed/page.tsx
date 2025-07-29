'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import BaseCard from '@/app/components/BaseCard';

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-lg shadow-md max-w-xl w-full"
      >
        <h1 className="text-2xl font-bold mb-4">Ranking Completed!</h1>
        <div className="mb-4">
          {loading ? (
            <p>Loading results...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold">Session Statistics</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <p>Total Cards: {statistics.totalCards}</p>
                  <p>Cards Ranked: {statistics.cardsRanked}</p>
                  <p>Cards Discarded: {statistics.cardsDiscarded}</p>
                  <p>Total Swipes: {statistics.totalSwipes}</p>
                  <p>Right Swipes: {statistics.rightSwipes}</p>
                  <p>Left Swipes: {statistics.leftSwipes}</p>
                  <p>Total Votes: {statistics.totalVotes}</p>
                  <p>Completion Rate: {statistics.completionRate}%</p>
                  <p>Session Duration: {statistics.sessionDuration} sec</p>
                </div>
              </div>

              <h2 className="text-lg font-semibold mb-4">Your Personal Ranking</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {ranking.map((item) => (
                  <div key={item.cardId} className="relative">
                    <BaseCard
                      uuid={item.cardId}
                      type={item.card.type}
                      content={item.card.content}
                      title={item.card.title}
                      size="small"
                      className="hover:scale-105 transition-transform duration-200"
                    >
                      {/* Ranking badge */}
                      <div className="absolute -top-2 -left-2 z-20">
                        <div className="ranking-position">
                          #{item.rank}
                        </div>
                      </div>
                    </BaseCard>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="space-y-4">
          <button
            onClick={() => router.push('/')}
            className="btn btn-primary w-full"
          >
            Start New Ranking
          </button>
          <button
            onClick={() => router.push('/cards')}
            className="btn btn-secondary w-full"
          >
            Manage Cards
          </button>
        </div>
      </motion.div>
    </div>
  );
}
