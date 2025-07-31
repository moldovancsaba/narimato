'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { SESSION_FIELDS } from '@/app/lib/constants/fieldNames';
import BaseCard from '@/app/components/BaseCard';
import PageLayout from '../components/PageLayout';

export default function CompletedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="loading-spinner"></div>
          <span className="ml-2 text-lg">Loading results...</span>
        </div>
      }
    >
      <CompletedContent />
    </Suspense>
  );
}

function CompletedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ranking, setRanking] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string>('');

  useEffect(() => {
    const loadResults = async () => {
      if (typeof window !== 'undefined') {
        // Check if there's a sessionId in URL parameters (shared link)
        const urlSessionId = searchParams.get('sessionId');
        
        if (urlSessionId) {
          // This is a shared link - fetch from saved results
          try {
            const response = await fetch(`/api/v1/session/results/${urlSessionId}`);
            const data = await response.json();
            
            if (data.error) {
              setError(data.error);
            } else {
              setRanking(data.personalRanking || []);
              setStatistics(data.statistics || {});
              setIsShared(true);
              setShareableUrl(`${window.location.origin}/completed?sessionId=${urlSessionId}`);
            }
          } catch (err) {
            setError('Failed to load shared session results.');
          }
        } else {
          // This is a fresh completion - fetch from current session
          const sessionId = localStorage.getItem(SESSION_FIELDS.ID);
          if (sessionId) {
            try {
              const response = await fetch(`/api/v1/session/results?sessionId=${sessionId}`);
              const data = await response.json();
              
              if (data.error) {
                setError(data.error);
              } else {
                setRanking(data.personalRanking || []);
                setStatistics(data.statistics || {});
                
                // Automatically save results for sharing
                try {
                  const saveResponse = await fetch('/api/v1/session/save-results', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [SESSION_FIELDS.ID]: sessionId })
                  });
                  
                  const saveData = await saveResponse.json();
                  if (saveData.success) {
                    setShareableUrl(`${window.location.origin}${saveData.shareableUrl}`);
                  }
                } catch (saveError) {
                  console.warn('Failed to save results for sharing:', saveError);
                }
              }
            } catch (err) {
              setError('Failed to load session results.');
            }
            
            // Clean up session data
            sessionStorage.clear();
            localStorage.removeItem(SESSION_FIELDS.ID);
            localStorage.removeItem('lastState');
            localStorage.removeItem('sessionVersion');
            localStorage.removeItem('deckState');
          } else {
            setError('No session found.');
          }
        }
        setLoading(false);
      }
    };
    
    loadResults();
  }, [searchParams]);

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
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Personal Ranking</h2>
        <p className="text-sm text-muted mb-4">
          This is your personal ranking based on your voting preferences. 
          For global rankings across all users (powered by ELO rating system), visit the <a href="/ranks" className="text-primary hover:underline">Global Rankings</a> page.
        </p>
      <div className="results-grid">
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

      {/* Share Section */}
      {shareableUrl && (
        <div className="mb-8">
          <div className="content-card">
            <h3 className="text-lg font-semibold mb-3">{isShared ? 'Shared Results' : 'Share Your Results'}</h3>
            <p className="text-sm text-muted mb-3">
              {isShared 
                ? 'These results have been shared with you.' 
                : 'Share your ranking results with others using this link:'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareableUrl}
                readOnly
                className="form-input flex-1 text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareableUrl);
                  // You could add a toast notification here
                }}
                className="btn btn-primary"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
