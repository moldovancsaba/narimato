import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Results() {
  const router = useRouter();
  const { playId, org, deck } = router.query;

  const [results, setResults] = useState(null);
  const [globalRankings, setGlobalRankings] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (playId) {
      fetchResults();
      fetchGlobalRankings();
      fetchCards();
    }
  }, [playId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/play/results?playId=${playId}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        console.error('Failed to fetch results');
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    }
  };

  const fetchGlobalRankings = async () => {
    try {
      const res = await fetch(`/api/cards/rankings?organizationId=${org}`);
      if (res.ok) {
        const data = await res.json();
        setGlobalRankings(data.rankings || []);
      } else {
        console.error('Failed to fetch global rankings');
      }
    } catch (error) {
      console.error('Failed to fetch global rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards?organizationId=${org}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const getCardDetails = (cardId) => {
    return cards.find(card => card.uuid === cardId) || { title: 'Unknown Card', description: '' };
  };

  const getGlobalRank = (cardId) => {
    const rank = globalRankings.findIndex(ranking => ranking.cardId === cardId);
    return rank >= 0 ? rank + 1 : null;
  };

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

  if (loading) return <div style={{ padding: '2rem' }}>Loading results...</div>;

  if (!results) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1>Results Not Found</h1>
        <p>Unable to load results for this play session.</p>
        <Link href="/play" style={{ color: '#0070f3' }}>← Back to Play</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/play" style={{ color: '#0070f3' }}>← Back to Play</Link>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1>🎉 Your {deck} Ranking Results!</h1>
        <p style={{ color: '#666' }}>Here's how you ranked the cards in this deck</p>
      </div>

      {/* Share Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '3rem', 
        textAlign: 'center' 
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>📤 Share Your Results</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666' }}>
          Share this link so others can see your ranking!
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={copyToClipboard}
            style={{ 
              padding: '0.5rem 1rem', 
              background: '#0070f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            📋 Copy Link
          </button>
          <button 
            onClick={shareResults}
            style={{ 
              padding: '0.5rem 1rem', 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            📱 Share
          </button>
        </div>
        {copySuccess && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#28a745' }}>
            {copySuccess}
          </div>
        )}
      </div>

      {/* Personal Ranking */}
      <div style={{ marginBottom: '3rem' }}>
        <h2>🏆 Your Personal Ranking</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {results.personalRanking?.map((cardId, index) => {
            const card = getCardDetails(cardId);
            const globalRank = getGlobalRank(cardId);
            return (
              <div 
                key={cardId} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '1rem', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  background: index === 0 ? '#fff3cd' : index === 1 ? '#e2e3e5' : index === 2 ? '#f8d7da' : 'white'
                }}
              >
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  minWidth: '3rem', 
                  textAlign: 'center',
                  color: index === 0 ? '#856404' : index === 1 ? '#495057' : index === 2 ? '#721c24' : '#333'
                }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </div>
                <div style={{ flex: 1, marginLeft: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.25rem 0' }}>{card.title}</h4>
                  {card.description && (
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>{card.description}</p>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#999' }}>
                  {globalRank && (
                    <div>Global: #{globalRank}</div>
                  )}
                </div>
              </div>
            );
          }) || <p>No personal ranking available.</p>}
        </div>
      </div>

      {/* Global Rankings */}
      <div style={{ marginBottom: '3rem' }}>
        <h2>🌍 Global Rankings</h2>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>See how cards rank globally across all users</p>
        
        {globalRankings.length === 0 ? (
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center', 
            background: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px dashed #ddd'
          }}>
            <p style={{ margin: '0', color: '#999' }}>
              🔄 Global rankings are being calculated...
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
              Rankings will appear as more users play and vote on cards.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {globalRankings.slice(0, 10).map((ranking, index) => {
              const card = getCardDetails(ranking.cardId);
              const isInMyRanking = results.personalRanking?.includes(ranking.cardId);
              return (
                <div 
                  key={ranking.cardId} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '0.75rem', 
                    border: `1px solid ${isInMyRanking ? '#28a745' : '#ddd'}`, 
                    borderRadius: '4px',
                    background: isInMyRanking ? '#f8fff8' : 'white'
                  }}
                >
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 'bold', 
                    minWidth: '2.5rem', 
                    textAlign: 'center',
                    color: index < 3 ? '#856404' : '#333'
                  }}>
                    #{index + 1}
                  </div>
                  <div style={{ flex: 1, marginLeft: '1rem' }}>
                    <div style={{ fontWeight: '500' }}>{card.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      Score: {ranking.globalScore} • Votes: {ranking.voteCount}
                      {isInMyRanking && <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>✓ In your ranking</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ textAlign: 'center', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link 
            href={`/play?org=${org}`}
            style={{ 
              padding: '0.75rem 1.5rem', 
              background: '#0070f3', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            🎮 Play Another Deck
          </Link>
          <Link 
            href={`/cards?org=${org}`}
            style={{ 
              padding: '0.75rem 1.5rem', 
              background: '#6c757d', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            📝 Manage Cards
          </Link>
        </div>
      </div>
    </div>
  );
}
