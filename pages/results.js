import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { event } from '../lib/analytics/ga';

export default function Results() {
  const router = useRouter();
  const { playId } = router.query;
  const queryOrg = router.query.org;
  const queryDeck = router.query.deck; // deckTag (parentTag)
  const mode = router.query.mode;

  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null); // 'not-found' when 404

  const [globalRankings, setGlobalRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);

  const [cards, setCards] = useState([]);
  const [extraCards, setExtraCards] = useState([]); // fetched on-demand for any missing IDs
  const [cardsLoading, setCardsLoading] = useState(false);

  const [copySuccess, setCopySuccess] = useState('');

  // Derive deckTag from query or results payloads (engines differ)
  const derivedDeck = useMemo(() => {
    return queryDeck || results?.deckTag || results?.sessionInfo?.deckTag || '';
  }, [queryDeck, results]);

  // NOTE: We assume org comes from the query (as per existing flows). If missing, you can derive it
  // by fetching any card's organizationId from /api/cards/[uuid]. For simplicity and consistency
  // with current routes, we keep queryOrg as authoritative here.
  const [orgFromCard, setOrgFromCard] = useState('');
  const [orgFromMeta, setOrgFromMeta] = useState('');
  const org =
    queryOrg ||
    orgFromCard ||
    orgFromMeta ||
    results?.organizationId ||
    results?.sessionInfo?.organizationId ||
    '';
  const deck = derivedDeck;

  useEffect(() => {
    if (!playId) return;
    setResultsLoading(true);
    setRankingsLoading(true); // will be cleared after global fetch
    setCardsLoading(true);    // will be cleared after cards fetch
    fetchResults();
  }, [playId]);

  // Once we know the deck (from query or results), fetch deck-scoped globals and cards
  useEffect(() => {
    if (!playId) return;
    if (!deck) return; // wait until deck is known

    if (!org && playId) {
      fetch(`/api/v1/play/${encodeURIComponent(playId)}/meta`)
        .then((r) => (r.ok ? r.json() : null))
        .then((meta) => {
          if (meta?.organizationId) setOrgFromMeta(meta.organizationId);
        })
        .catch(() => {});
    }

    if (!org && results) {
      const candidateId =
        (Array.isArray(results.ranking) && (results.ranking[0]?.card?.id || results.ranking[0]?.cardId)) ||
        (Array.isArray(results.personalRanking) && results.personalRanking[0]) ||
        '';
      const knownOrg =
        results.organizationId || results.sessionInfo?.organizationId || queryOrg || '';
      if (candidateId && knownOrg) {
        fetch(`/api/cards/${encodeURIComponent(candidateId)}?organizationId=${encodeURIComponent(knownOrg)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((card) => {
            if (card?.organizationId) setOrgFromCard(card.organizationId);
          })
          .catch(() => {});
      }
    }

    const resolvedOrg =
      queryOrg ||
      orgFromMeta ||
      orgFromCard ||
      results?.organizationId ||
      results?.sessionInfo?.organizationId ||
      '';
    if (!resolvedOrg) return;

    fetchGlobalRankings(resolvedOrg, deck);
    fetchCards(resolvedOrg, deck);
  }, [playId, results, queryOrg, orgFromMeta, orgFromCard, deck]);

  // FUNCTIONAL: Track results page engagement
  // STRATEGIC: Measures post-play behavior and results consumption (production-only)
  useEffect(() => {
    if (results && playId) {
      event('results_view', {
        playId,
        org,
        deck,
        mode
      });
    }
  }, [results, playId, org, deck, mode]);

  const fetchResults = async () => {
    try {
      setResultsError(null);
      // Use unified results API for all modes
      const apiEndpoint = `/api/v1/play/${playId}/results`;
      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else if (res.status === 404) {
        setResultsError('not-found');
      } else {
        console.error('Failed to fetch results');
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setResultsLoading(false);
    }
  };

  const fetchGlobalRankings = async (organizationId, deckTag) => {
    try {
      const params = new URLSearchParams({ organizationId });
      if (deckTag) params.set('parentTag', deckTag);
      const res = await fetch(`/api/cards/rankings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGlobalRankings(data.rankings || []);
      } else {
        console.error('Failed to fetch global rankings');
      }
    } catch (error) {
      console.error('Failed to fetch global rankings:', error);
    } finally {
      setRankingsLoading(false);
    }
  };

  const fetchCards = async (organizationId, deckTag) => {
    try {
      const params = new URLSearchParams({ organizationId });
      if (deckTag) params.set('parentTag', deckTag);
      const res = await fetch(`/api/cards?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setCardsLoading(false);
    }
  };

  const cardsMap = useMemo(() => {
    const map = new Map();
    [...cards, ...extraCards].forEach(c => { if (c?.uuid) map.set(c.uuid, c); });
    return map;
  }, [cards, extraCards]);

  const getCardDetails = (cardId) => {
    return cardsMap.get(cardId) || { title: 'Unknown Card', description: '' };
  };

  // Ensure global rankings include every card in the deck (append zero-vote cards at the end)
  const fullGlobalRankings = useMemo(() => {
    const base = Array.isArray(globalRankings) ? [...globalRankings] : [];
    const baseIds = new Set(base.map(r => r.cardId));
    const deckIds = cards.map(c => c.uuid);
    const missing = deckIds
      .filter(id => !baseIds.has(id))
      .map((id, idx) => {
        const c = cardsMap.get(id);
        return {
          rank: base.length + idx + 1,
          cardId: id,
          globalScore: (c && c.globalScore) || 1500,
          voteCount: (c && c.voteCount) || 0,
          winCount: (c && c.winCount) || 0,
          winRate: 0,
        };
      });
    return [...base, ...missing];
  }, [globalRankings, cards, cardsMap]);

  const getGlobalRank = (cardId) => {
    const rank = fullGlobalRankings.findIndex(ranking => ranking.cardId === cardId);
    return rank >= 0 ? rank + 1 : null;
  };

  const personalIds = useMemo(() => {
    if (!results) return [];
    if (Array.isArray(results.ranking) && results.ranking.length > 0) {
      return results.ranking.map(r => r.card?.id || r.cardId).filter(Boolean);
    }
    if (Array.isArray(results.personalRanking)) return results.personalRanking;
    return [];
  }, [results]);

  const summary = useMemo(() => {
    const globalIds = fullGlobalRankings.map(r => r.cardId);
    const pTop = personalIds.slice(0, 3);
    const pLast = personalIds.length > 0 ? personalIds[personalIds.length - 1] : null;
    const gTop = globalIds.slice(0, 3);
    const gLast = globalIds.length > 0 ? globalIds[globalIds.length - 1] : null;
    return {
      personalTop3: pTop,
      personalLast: pLast,
      globalTop3: gTop,
      globalLast: gLast
    };
  }, [personalIds, globalRankings]);

  const copyToClipboard = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess('✅ Link copied!');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (err) {
      setCopySuccess('❌ Failed to copy');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  const shareResults = async () => {
    const currentUrl = window.location.href;
    const shareData = {
      title: `My ${deck} Ranking Results - Narimato`,
      text: `Check out my personal ranking results for the ${deck} deck!`,
      url: currentUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy link
        copyToClipboard();
      }
    } catch (err) {
      console.log('Error sharing:', err);
      copyToClipboard(); // Fallback
    }
  };

  // Proactively fetch any missing card details needed for rendering
  useEffect(() => {
    if (!playId) return;
    const needed = new Set([
      ...personalIds,
      ...globalRankings.map(r => r.cardId)
    ]);
    const known = new Set([
      ...cards.map(c => c.uuid),
      ...extraCards.map(c => c.uuid)
    ]);
    const missing = [...needed].filter(id => id && !known.has(id));
    if (missing.length === 0) return;

    const cardOrg =
      queryOrg ||
      orgFromMeta ||
      orgFromCard ||
      results?.organizationId ||
      results?.sessionInfo?.organizationId ||
      '';
    if (!cardOrg) return;

    Promise.all(
      missing.map((id) =>
        fetch(
          `/api/cards/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(cardOrg)}`
        ).then((r) => (r.ok ? r.json() : null))
      )
    ).then(list => {
      const toAdd = list.filter(c => c && c.uuid && !known.has(c.uuid));
      if (toAdd.length > 0) setExtraCards(prev => [...prev, ...toAdd]);
    }).catch(() => {});
  }, [playId, personalIds, globalRankings, cards, extraCards]);

  const loading = resultsLoading || rankingsLoading || cardsLoading;

  if (loading) return <div style={{ padding: '2rem' }}>Loading results...</div>;

  // Only show Not Found when the results endpoint explicitly returned 404
  if (resultsError === 'not-found') {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1>Results Not Found</h1>
        <p>Unable to load results for this play session.</p>
        <Link href="/play" style={{ color: '#0070f3' }}>← Back to Play</Link>
      </div>
    );
  }

  // Defensive guard: if results still null for any reason, keep loading instead of flashing Not Found
  if (!results) return <div style={{ padding: '2rem' }}>Loading results...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
      <style jsx>{`
        /* Results Compare Grid alignment updates
           - What: Bring Personal and Global columns closer and align titles toward the center.
           - Why: Improves horizontal proximity and visual balance as requested, while preserving
                  right alignment for Personal content and left alignment for Global content on desktop. */
        .compare-grid { display: grid; grid-template-columns: 1fr; row-gap: 1rem; }

        /* Two-column header: reduce inter-column gap from 2rem -> 1rem; keep items aligned at bottom. */
        .compare-header { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: end; }

        /* Row layout: mirror header spacing (2rem -> 1rem) and keep alignment by column. */
        .compare-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }

        /* Desktop column content alignment:
           - Personal (left column) content right-aligned to sit near the page center.
           - Global   (right column) content left-aligned to sit near the page center. */
        .leftCell { display: flex; justify-content: flex-end; }
        .rightCell { display: flex; justify-content: flex-start; }

        /* Card height equalization and info block alignment for perfect row alignment.
           What: Ensure cards have equal heights per row and info blocks align independently.
           Why: Achieves precise visual alignment between Personal and Global columns regardless
                of card content differences (title length, description, images). */
        
        /* Card containers: flexible layout with consistent structure */
        .card-with-info {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        /* Cards: equalized minimum height with flex growth */
        .compare-row .card {
          min-height: 120px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        /* Info blocks: consistent positioning at bottom with proper text alignment */
        .card-info {
          margin-top: auto;
          padding-top: 0.5rem;
        }
        
        /* Personal (left) column: right-align all info text to sit flush toward center */
        .leftCell .card-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
        .leftCell .card-info-title { text-align: right; }
        .leftCell .card-info-meta { text-align: right; }
        
        /* Global (right) column: explicitly left-align info text for symmetry */
        .rightCell .card-info { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
        .rightCell .card-info-title { text-align: left; }
        .rightCell .card-info-meta { text-align: left; }

        /* Ensure the card boxes themselves align flush to the center edge per column */
        .leftCell .card-with-info .card { align-self: flex-end; margin-left: auto; }
        .rightCell .card-with-info .card { align-self: flex-start; margin-right: auto; }

        /* Desktop header title alignment:
           - Personal title pushed inward and right-aligned to match its column content.
           - Global   title pushed inward and left-aligned to match its column content. */
        .compare-header h2:first-child { justify-self: end; text-align: right; }
        .compare-header h2:last-child  { justify-self: start; text-align: left; }

        @media (max-width: 900px) {
          /* On mobile, stack columns and center titles/content for clarity. */
          .compare-header, .compare-row { grid-template-columns: 1fr; }
          .leftCell, .rightCell { justify-content: center; }
          .compare-header h2 { justify-self: center; text-align: center; }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>🎉 Your {deck} Ranking Results!</h1>
        <p style={{ color: '#666' }}>
          {mode === 'swipe-only' ? 'Your swipe-based preference ranking' : 
           mode === 'swipe-more' ? 'Your hybrid swipe + vote ranking' :
           'Here\'s how you ranked the cards in this deck'}
        </p>
        {mode && (
          <div style={{ 
            display: 'inline-block', 
            padding: '0.25rem 0.75rem', 
            background: mode === 'swipe-only' ? '#ff6b6b' : 
                       mode === 'swipe-more' ? '#845ec2' : 
                       mode === 'vote-only' ? '#17a2b8' : '#845ec2',
            color: 'white', 
            borderRadius: '12px', 
            fontSize: '0.8rem', 
            fontWeight: '500' 
          }}>
            {mode === 'swipe-only' ? '👆 Swipe Only' : 
             mode === 'swipe-more' ? '🔄 Swipe + Vote' : 
             mode === 'vote-only' ? '🗳️ Vote Only' : 
             mode === 'vote-more' ? '🗳️ Vote More' : 
             mode === 'rank-only' ? '👆+🗳️ Rank Only' : mode}
          </div>
        )}
      </div>

      {/* Share Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem', 
        textAlign: 'center' 
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>📤 Share Your Results</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666' }}>
          Share this link so others can see your ranking!
        </p>
        <div className="btn-group">
          <button onClick={copyToClipboard} className="btn btn-info">📋 Copy Link</button>
          <button onClick={shareResults} className="btn btn-primary">📱 Share</button>
        </div>
        {copySuccess && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#28a745' }}>
            {copySuccess}
          </div>
        )}
      </div>

      {/* Summary: Personal vs Global Top/Bottom for this deck */}
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 0.75rem 0' }}>📊 Summary — Deck: {deck}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.95rem', color: '#333', justifyContent: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>🏆 Your Top 3</div>
            <div>{summary.personalTop3.map(id => getCardDetails(id).title).filter(Boolean).join(' • ') || '—'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>🌍 Global Top 3</div>
            <div>{summary.globalTop3.map(id => getCardDetails(id).title).filter(Boolean).join(' • ') || '—'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>🏁 Your Last</div>
            <div>{summary.personalLast ? getCardDetails(summary.personalLast).title : '—'}</div>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>🧭 Global Last</div>
            <div>{summary.globalLast ? getCardDetails(summary.globalLast).title : '—'}</div>
          </div>
        </div>
      </div>

      {/* Two Columns: aligned row-by-row */}
      <div className="compare-grid">
        <div className="compare-header">
          <h2>🏆 Your Personal Ranking</h2>
          <h2>🌍 Global Rankings</h2>
        </div>
        {Array.from({ length: Math.max(
            (Array.isArray(results.ranking) ? results.ranking.length : (Array.isArray(results.personalRanking) ? results.personalRanking.length : 0)),
            fullGlobalRankings.length
          ) }).map((_, index) => {
            const leftItem = Array.isArray(results.ranking) ? results.ranking[index] : undefined;
            const leftId = leftItem ? (leftItem.card?.id || leftItem.cardId) : (Array.isArray(results.personalRanking) ? results.personalRanking[index] : undefined);
            const leftCard = leftItem ? (leftItem.card || (leftItem.cardId ? getCardDetails(leftItem.cardId) : null)) : (leftId ? getCardDetails(leftId) : null);
            const leftGRank = leftCard ? getGlobalRank(leftCard.id || leftCard.uuid) : null;

            const rightItem = fullGlobalRankings[index];
            const rightCard = rightItem ? getCardDetails(rightItem.cardId) : null;
            const isInMyRanking = rightItem ? personalIds.includes(rightItem.cardId) : false;

            return (
              <div key={index} className="compare-row">
                <div className="leftCell">
                  {leftCard ? (
                    <div className="card-with-info" style={{ width: '360px', maxWidth: '100%' }}>
                      <div className={`card card-md card-interactive ${leftCard.imageUrl ? 'has-image' : ''} ${index === 0 ? 'card-winner' : index === 1 ? 'card-selected' : index === 2 ? 'card-error' : ''}`}>
                        <div className="card-title">{leftCard.title}</div>
                        {leftCard.description && <div className="card-description">{leftCard.description}</div>}
                        {leftCard.imageUrl && <img src={leftCard.imageUrl} alt={leftCard.title} className="card-image" />}
                      </div>
                      <div className="card-info">
                        <div className="card-info-title" style={{ color: index === 0 ? '#856404' : index === 1 ? '#495057' : index === 2 ? '#721c24' : '#333' }}>
                          {index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`}
                        </div>
                        {leftGRank && (
                          <div className="card-info-meta">Global Rank: #{leftGRank}</div>
                        )}
                        {mode === 'swipe-only' && leftItem?.swipedAt && (
                          <div className="card-info-meta">Liked: {new Date(leftItem.swipedAt).toLocaleTimeString()}</div>
                        )}
                        {mode === 'swipe-more' && leftItem && (
                          <div className="card-info-meta">
                            {leftItem.swipedAt && (<div>Liked: {new Date(leftItem.swipedAt).toLocaleTimeString()}</div>)}
                            {leftItem.wins !== undefined && leftItem.totalComparisons && (<div>Votes: {leftItem.wins}/{leftItem.totalComparisons}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : <div style={{ width: '360px', maxWidth: '100%' }} /> }
                </div>
                <div className="rightCell">
                  {rightCard ? (
                    <div className="card-with-info" style={{ width: '360px', maxWidth: '100%' }}>
                      <div className={`card card-md card-interactive ${rightCard.imageUrl ? 'has-image' : ''} ${isInMyRanking ? 'card-success' : index < 3 ? 'card-selected' : ''}`}>
                        <div className="card-title">{rightCard.title}</div>
                        {rightCard.description && <div className="card-description">{rightCard.description}</div>}
                        {rightCard.imageUrl && <img src={rightCard.imageUrl} alt={rightCard.title} className="card-image" />}
                      </div>
                      <div className="card-info">
                        <div className="card-info-title" style={{ color: index < 3 ? '#856404' : '#333' }}>#{index + 1} Global</div>
                        <div className="card-info-meta">
                          Score: {rightItem.globalScore} • Votes: {rightItem.voteCount}
                          {isInMyRanking && <div style={{ color: '#28a745' }}>✓ In your ranking</div>}
                        </div>
                      </div>
                    </div>
                  ) : <div style={{ width: '360px', maxWidth: '100%' }} /> }
                </div>
              </div>
            );
          })}
      </div>

      {/* Action Buttons */}
      <div style={{ textAlign: 'center', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
        <Link 
          href={`/play?org=${org}`}
          className="btn btn-warning"
        >
          🎮 Play Another Deck
        </Link>
      </div>
    </div>
  );
}
