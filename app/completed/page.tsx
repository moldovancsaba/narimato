'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import BaseCard from '@/app/components/BaseCard';
import MobileLayout, { MobilePageHeader, MobileCardGrid, MobileButtonGroup } from '@/app/components/MobileLayout';

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
    <MobileLayout className="bg-gray-100 flex flex-col items-center justify-start pt-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-md max-w-4xl w-full"
      >
        <div className="p-4 sm:p-6 md:p-8">
          <MobilePageHeader 
            title="Ranking Completed!" 
            className="border-b border-gray-200 pb-4 sm:pb-6 mb-4 sm:mb-6"
          />
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-pulse text-lg">Loading results...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 text-lg">{error}</p>
            </div>
          ) : (
            <>
              {/* Session Statistics */}
              <div className="mb-8">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">Session Statistics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{statistics.totalCards}</div>
                    <div className="text-sm text-gray-600">Total Cards</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{statistics.cardsRanked}</div>
                    <div className="text-sm text-gray-600">Cards Ranked</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{statistics.cardsDiscarded}</div>
                    <div className="text-sm text-gray-600">Cards Discarded</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{statistics.totalSwipes}</div>
                    <div className="text-sm text-gray-600">Total Swipes</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">{statistics.totalVotes}</div>
                    <div className="text-sm text-gray-600">Total Votes</div>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{statistics.completionRate}%</div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                  </div>
                </div>
              </div>

              {/* Personal Ranking */}
              <div className="mb-8">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Your Personal Ranking</h2>
                <MobileCardGrid columns="auto" gap="md">
                  {ranking.map((item) => (
                    <div key={item.cardId} className="relative">
                      <BaseCard
                        uuid={item.cardId}
                        type={item.card.type}
                        content={item.card.content}
                        size="small"
                        className="transition-transform duration-200"
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
                </MobileCardGrid>
              </div>
            </>
          )}
          
          {/* Action Buttons */}
          <MobileButtonGroup className="pt-4 border-t border-gray-200">
            <button
              onClick={() => router.push('/')}
              className="btn btn-primary flex-1 sm:flex-none sm:min-w-[160px]"
            >
              Start New Ranking
            </button>
            <button
              onClick={() => router.push('/cards')}
              className="btn btn-secondary flex-1 sm:flex-none sm:min-w-[160px]"
            >
              Manage Cards
            </button>
          </MobileButtonGroup>
        </div>
      </motion.div>
    </MobileLayout>
  );
}
