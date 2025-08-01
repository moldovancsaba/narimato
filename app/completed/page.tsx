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
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 80px)' }}>
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
  const [error, setError] = useState<any>(null);
  const [isShared, setIsShared] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string>('');

  useEffect(() => {
    const loadResults = async () => {
      if (typeof window !== 'undefined') {
        // Check if there's a sessionId in URL parameters (shared link)
const urlPlayId = searchParams.get('sessionId'); // Using sessionId parameter name for backward compatibility
        
        if (urlPlayId) {
          // This is a shared link - fetch from saved results
          try {
            const response = await fetch(`/api/v1/play/results/${urlPlayId}`);
            const data = await response.json();
            
            if (data.error) {
              setError(data);
            } else {
              setRanking(data.personalRanking || []);
              setStatistics(data.statistics || {});
              setIsShared(true);
              setShareableUrl(`${window.location.origin}/completed?sessionId=${urlPlayId}`);
            }
          } catch (err) {
            setError('Failed to load shared session results.');
          }
        } else {
          // This is a fresh completion - fetch from current session
          const playId = localStorage.getItem(SESSION_FIELDS.ID);
          if (playId) {
            // Add retry logic to handle race condition between session completion and results saving
            const maxRetries = 3;
            const retryDelay = 1000; // 1 second
            
            let retryCount = 0;
            let success = false;
            
            while (retryCount < maxRetries && !success) {
              try {
                const response = await fetch(`/api/v1/play/results?sessionId=${playId}`); // Using sessionId parameter name for backward compatibility
                const data = await response.json();
                
                if (data.error) {
                  if (retryCount < maxRetries - 1) {
                    console.log(`Results not ready yet, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    retryCount++;
                    continue;
                  } else {
                    setError({ ...data });
                    break;
                  }
                } else {
                  setRanking(data.personalRanking || []);
                  setStatistics(data.statistics || {});
                  success = true;
                  
                  // Automatically save results for sharing
                  try {
                    const saveResponse = await fetch('/api/v1/session/save-results', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ [SESSION_FIELDS.ID]: playId })
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
                if (retryCount < maxRetries - 1) {
                  console.log(`Network error, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                  retryCount++;
                  continue;
                } else {
                  setError('Failed to load session results.');
                  break;
                }
              }
            }
            
            // Clean up play data but keep browser session ID for analytics
            sessionStorage.clear();
            localStorage.removeItem(SESSION_FIELDS.ID); // Remove play UUID
            localStorage.removeItem('lastState');
            localStorage.removeItem('sessionVersion');
            localStorage.removeItem('deckState');
            // Keep browserSessionId for analytics continuity
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
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="loading-spinner"></div>
        <span className="ml-2 text-lg">Loading results...</span>
      </div>
    );
  }

  if (error) {
    // Handle detailed error response vs simple string error
    const isDetailedError = typeof error === 'object' && error.errorCode;
    const errorMessage = isDetailedError ? error.error : error;
    const errorDetails = isDetailedError ? error.details : null;
    const errorSuggestions = isDetailedError ? error.suggestions : [];
    
    return (
      <PageLayout title="Unable to Load Results">
        <div className="max-w-2xl mx-auto">
          {/* Main Error Message */}
          <div className="status-error p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-2">⚠️ {errorMessage}</h2>
            {errorDetails && (
              <p className="text-sm mb-4 opacity-90">{errorDetails}</p>
            )}
          </div>
          
          {/* Recovery Suggestions */}
          {errorSuggestions.length > 0 && (
            <div className="content-card mb-6">
              <h3 className="text-lg font-semibold mb-3">💡 What you can try:</h3>
              <ul className="space-y-2">
                {errorSuggestions.map((suggestion: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={() => router.push('/')} 
              className="btn btn-primary"
            >
              🏠 Start New Session
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-secondary"
            >
              🔄 Try Again
            </button>
            <button 
              onClick={() => router.push('/ranks')} 
              className="btn btn-secondary"
            >
              📊 View Global Rankings
            </button>
          </div>
          
          {/* Additional Help */}
          <div className="mt-8 p-4 bg-muted/30 rounded-lg text-center">
            <p className="text-sm text-muted">
              If this problem persists, the session may have expired or the link might be invalid.
              <br />
              Creating a new session usually resolves this issue.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout title="Your Ranking">
      {/* Share Section - moved above the ranked cards */}
      {shareableUrl && (
        <div className="mb-8">
          <div className="content-card">
            <h3 className="text-lg font-semibold mb-3">{isShared ? 'Share it' : 'Share Your Results'}</h3>
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

      <div className="mb-8">
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

    </PageLayout>
  );
}
