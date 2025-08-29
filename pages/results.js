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
        <div className="btn-group">
          <button 
            onClick={copyToClipboard}
            className="btn btn-info"
          >
            📋 Copy Link
          </button>
          <button 
            onClick={shareResults}
            className="btn btn-primary"
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
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {results.personalRanking?.map((cardId, index) => {
            const card = getCardDetails(cardId);
            const globalRank = getGlobalRank(cardId);
            return (
              <div key={cardId} className="card-with-info">
                <div className={`card card-md card-interactive ${card.imageUrl ? 'has-image' : ''} ${
                  index === 0 ? 'card-winner' : index === 1 ? 'card-selected' : index === 2 ? 'card-error' : ''
                }`}>
                  <div className="card-title">{card.title}</div>
                  {card.description && <div className="card-description">{card.description}</div>}
                  {card.imageUrl && <img src={card.imageUrl} alt={card.title} className="card-image" />}
                </div>
                <div className="card-info">
                  <div className="card-info-title" style={{ 
                    color: index === 0 ? '#856404' : index === 1 ? '#495057' : index === 2 ? '#721c24' : '#333'
                  }}>
                    {index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`}
                  </div>
                  {globalRank && (
                    <div className="card-info-meta">Global Rank: #{globalRank}</div>
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
          <div className="card-grid card-grid-sm">
            {globalRankings.slice(0, 12).map((ranking, index) => {
              const card = getCardDetails(ranking.cardId);
              const isInMyRanking = results.personalRanking?.includes(ranking.cardId);
              return (
                <div key={ranking.cardId} className="card-with-info">
                  <div className={`card card-sm card-interactive ${card.imageUrl ? 'has-image' : ''} ${
                    isInMyRanking ? 'card-success' : index < 3 ? 'card-selected' : ''
                  }`}>
                    <div className="card-title">{card.title}</div>
                    {card.description && <div className="card-description">{card.description}</div>}
                    {card.imageUrl && <img src={card.imageUrl} alt={card.title} className="card-image" />}
                  </div>
                  <div className="card-info">
                    <div className="card-info-title" style={{ 
                      color: index < 3 ? '#856404' : '#333'
                    }}>
                      #{index + 1} Global
                    </div>
                    <div className="card-info-meta">
                      Score: {ranking.globalScore} • Votes: {ranking.voteCount}
                      {isInMyRanking && <div style={{ color: '#28a745' }}>✓ In your ranking</div>}
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
