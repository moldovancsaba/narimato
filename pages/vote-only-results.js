import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// FUNCTIONAL: VoteOnly results page using existing results UI patterns
// STRATEGIC: Reuse existing results display logic for consistency

export default function VoteOnlyResults() {
  const router = useRouter();
  const { playId, org, deck } = router.query;
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (playId) {
      fetchResults();
    }
  }, [playId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/vote-only/${playId}/results`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        console.error('Failed to fetch VoteOnly results');
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading results...</div>;
  }

  if (!results) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Results not found</h2>
        <Link href={`/play?org=${org}`}>← Back to deck selection</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href={`/play?org=${org}`} style={{ color: '#0070f3' }}>← Back to deck selection</Link>
      </div>

      <h1>🏆 Tournament Results</h1>
      <p>Deck: <strong>{results.sessionInfo.deckTag}</strong></p>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Tournament Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
            <strong>Total Cards:</strong> {results.statistics.totalCards}
          </div>
          <div style={{ padding: '1rem', background: '#e8f5e8', borderRadius: '4px' }}>
            <strong>Comparisons:</strong> {results.statistics.totalComparisons}
          </div>
          <div style={{ padding: '1rem', background: '#e8f0ff', borderRadius: '4px' }}>
            <strong>Efficiency:</strong> {results.statistics.efficiency}%
          </div>
        </div>
      </div>

      <h3>Tournament Ranking</h3>
      {results.ranking.length > 0 ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {results.ranking.map((item, index) => (
            <div 
              key={item.card.id} 
              style={{ 
                padding: '1rem', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                background: index < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][index] : '#f8f9fa',
                color: index < 3 ? 'white' : 'black'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  minWidth: '3rem',
                  textAlign: 'center'
                }}>
                  #{item.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{item.card.title}</h4>
                  {item.card.description && (
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', opacity: 0.8 }}>
                      {item.card.description}
                    </p>
                  )}
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                    <strong>Win Rate:</strong> {item.statistics.winRate}% 
                    ({item.statistics.wins}/{item.statistics.comparisons})
                  </div>
                </div>
                {item.card.imageUrl && (
                  <img 
                    src={item.card.imageUrl} 
                    alt={item.card.title}
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No ranking data available.</p>
      )}

      <div style={{ marginTop: '2rem' }}>
        <Link href={`/play?org=${org}`} className="btn btn-primary">
          Rank Another Deck
        </Link>
      </div>
    </div>
  );
}
