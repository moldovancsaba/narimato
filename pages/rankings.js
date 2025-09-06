import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Rankings() {
  const router = useRouter();
  const { org, deck } = router.query;

  const [organizations, setOrganizations] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState(deck || 'all');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (org) {
      fetchCards();
      fetchRankings();
    }
  }, [org, selectedDeck]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
      
      // If no org selected, select the first one
      if (!org && data.organizations?.length > 0) {
        router.push(`/rankings?org=${data.organizations[0].uuid}`);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards?organizationId=${org}`);
      const data = await res.json();
      setCards(data.cards || []);
      
      // Extract unique decks
      const deckGroups = {};
      data.cards?.forEach(card => {
        if (card.parentTag) {
          if (!deckGroups[card.parentTag]) {
            deckGroups[card.parentTag] = [];
          }
          deckGroups[card.parentTag].push(card);
        }
      });
      
      const deckList = Object.entries(deckGroups)
        .filter(([tag, cards]) => cards.length >= 2)
        .map(([tag, cards]) => ({ tag, count: cards.length }));
      
      setDecks(deckList);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const fetchRankings = async () => {
    try {
      const params = new URLSearchParams({ organizationId: org });
      if (selectedDeck && selectedDeck !== 'all') {
        params.append('parentTag', selectedDeck);
      }
      
      const res = await fetch(`/api/cards/rankings?${params}`);
      const data = await res.json();
      setRankings(data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    }
  };

  const getCardDetails = (cardId) => {
    return cards.find(card => card.uuid === cardId) || { title: 'Unknown Card', description: '', parentTag: '' };
  };

  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.uuid === orgId);
    return org ? org.name : 'Unknown Organization';
  };

  const handleDeckChange = (deckTag) => {
    setSelectedDeck(deckTag);
    const params = new URLSearchParams({ org });
    if (deckTag !== 'all') {
      params.append('deck', deckTag);
    }
    router.push(`/rankings?${params}`);
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading rankings...</div>;

  return (
    <>
      <style jsx>{`
        @media (max-width: 768px) {
          .rankings-desktop {
            display: none !important;
          }
          .rankings-mobile {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .rankings-desktop {
            display: block !important;
          }
          .rankings-mobile {
            display: none !important;
          }
        }
      `}</style>
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        {/* FUNCTIONAL: Standardize small back navigation button */}
        {/* STRATEGIC: Consistent look-and-feel across pages */}
        <Link href="/" className="btn btn-light btn-sm">← Back to Home</Link>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1>🌍 Global Rankings</h1>
        <p style={{ color: '#666' }}>See how cards rank across all users based on ELO ratings</p>
      </div>

      {/* Organization Selection */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>Organization</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {organizations.map(organization => (
            <Link
              key={organization.uuid}
              href={`/rankings?org=${organization.uuid}`}
              className={`btn ${org === organization.uuid ? 'btn-primary' : 'btn-muted'}`}
            >
              {organization.name}
            </Link>
          ))}
        </div>
      </div>

      {org && (
        <>
          {/* Deck Filter */}
          <div style={{ marginBottom: '3rem' }}>
            <h3>Filter by Deck</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleDeckChange('all')}
                className={`btn ${selectedDeck === 'all' ? 'btn-success' : 'btn-muted'}`}
              >
                All Decks ({rankings.length})
              </button>
              {decks.map(deckInfo => (
                <button
                  key={deckInfo.tag}
                  onClick={() => handleDeckChange(deckInfo.tag)}
                  className={`btn ${selectedDeck === deckInfo.tag ? 'btn-success' : 'btn-muted'}`}
                >
                  {deckInfo.tag} ({deckInfo.count})
                </button>
              ))}
            </div>
          </div>

          {/* Rankings Table */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>
                🏆 Rankings
                {selectedDeck !== 'all' && <span style={{ color: '#666', fontWeight: 'normal' }}> - {selectedDeck}</span>}
              </h2>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                {rankings.length} cards ranked
              </div>
            </div>

            {rankings.length === 0 ? (
              <div style={{ 
                padding: '3rem', 
                textAlign: 'center', 
                background: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px dashed #ddd'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#999' }}>📊 No Rankings Yet</h3>
                <p style={{ margin: '0 0 1rem 0', color: '#666' }}>
                  Rankings will appear once users start playing and voting on cards.
                </p>
                <Link 
                  href={`/play?org=${org}`}
                  className="btn btn-primary"
                >
                  🎮 Start Playing
                </Link>
              </div>
            ) : (
              <>
              {/* Desktop Table View */}
              <div className="rankings-desktop" style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                {/* Header */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 80px 1fr 120px 100px 100px 80px', 
                  gap: '1rem', 
                  padding: '1rem', 
                  background: '#f8f9fa', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #ddd'
                }}>
                  <div>Rank</div>
                  <div>Preview</div>
                  <div>Card</div>
                  <div>ELO Score</div>
                  <div>Votes</div>
                  <div>Wins</div>
                  <div>Win Rate</div>
                </div>

                {/* Rankings */}
                {rankings.map((ranking, index) => {
                  const card = getCardDetails(ranking.cardId);
                  const isTopThree = index < 3;
                  
                  return (
                    <div 
                      key={ranking.cardId}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '60px 80px 1fr 120px 100px 100px 80px', 
                        gap: '1rem', 
                        padding: '1rem', 
                        borderBottom: index < rankings.length - 1 ? '1px solid #eee' : 'none',
                        background: isTopThree ? (index === 0 ? '#fff3cd' : index === 1 ? '#e2e3e5' : '#f8d7da') : 'white',
                        alignItems: 'center'
                      }}
                    >
                      {/* Rank */}
                      <div style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 'bold',
                        color: isTopThree ? (index === 0 ? '#856404' : index === 1 ? '#495057' : '#721c24') : '#333'
                      }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </div>

                      {/* Card Preview */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className={`card card-sm ${card.imageUrl ? 'has-image' : ''}`} style={{ width: '60px', height: '60px', padding: '0.25rem' }}>
                          <div className="card-title" style={{ fontSize: '0.6rem', margin: 0, lineHeight: '1.1' }}>{card.title}</div>
                          {card.description && <div className="card-description" style={{ fontSize: '0.5rem', margin: 0, lineHeight: '1.1' }}>{card.description}</div>}
                          {card.imageUrl && <img src={card.imageUrl} alt={card.title} className="card-image" />}
                        </div>
                      </div>

                      {/* Card Details */}
                      <div>
                        <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                          {card.title}
                        </div>
                        {card.description && (
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            {card.description}
                          </div>
                        )}
                        {card.parentTag && (
                          <div style={{ fontSize: '0.75rem', color: '#28a745', marginTop: '0.25rem' }}>
                            {card.parentTag}
                          </div>
                        )}
                      </div>

                      {/* ELO Score */}
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '1.1rem',
                        color: ranking.globalScore >= 1600 ? '#28a745' : ranking.globalScore >= 1400 ? '#ffc107' : '#dc3545'
                      }}>
                        {ranking.globalScore}
                      </div>

                      {/* Votes */}
                      <div style={{ textAlign: 'center' }}>
                        {ranking.voteCount}
                      </div>

                      {/* Wins */}
                      <div style={{ textAlign: 'center', color: '#28a745', fontWeight: '500' }}>
                        {ranking.winCount}
                      </div>

                      {/* Win Rate */}
                      <div style={{ 
                        textAlign: 'center', 
                        fontWeight: '500',
                        color: ranking.winRate >= 60 ? '#28a745' : ranking.winRate >= 40 ? '#ffc107' : '#dc3545'
                      }}>
                        {ranking.winRate}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Card View */}
              <div className="rankings-mobile" style={{ display: 'none' }}>
                <div className="card-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                  {rankings.map((ranking, index) => {
                    const card = getCardDetails(ranking.cardId);
                    const isTopThree = index < 3;
                    
                    const cardClasses = [
                      'card',
                      'card-md', 
                      'card-interactive',
                      card.imageUrl ? 'has-image' : '',
                      isTopThree ? (index === 0 ? 'card-winner' : index === 1 ? 'card-selected' : 'card-error') : ''
                    ].filter(Boolean).join(' ');
                    
                    return (
                      <div key={ranking.cardId} className="card-with-info">
                        <div className={cardClasses}>
                          <div className="card-title">{card.title}</div>
                          {card.description && <div className="card-description">{card.description}</div>}
                          {card.imageUrl && <img src={card.imageUrl} alt={card.title} className="card-image" />}
                        </div>
                        <div className="card-info">
                          <div className="card-info-title" style={{ 
                            color: isTopThree ? (index === 0 ? '#856404' : index === 1 ? '#495057' : '#721c24') : '#333',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span>{index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`}</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{ranking.globalScore}</span>
                          </div>
                          <div className="card-info-meta">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span>Votes: {ranking.voteCount}</span>
                              <span>Wins: {ranking.winCount}</span>
                            </div>
                            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>Win Rate: {ranking.winRate}%</div>
                            {card.parentTag && (
                              <div style={{ color: '#28a745', marginTop: '0.25rem', textAlign: 'center' }}>
                                {card.parentTag}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ textAlign: 'center', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link 
                href={`/play?org=${org}`}
                className="btn btn-warning"
              >
                🎮 Play
              </Link>
              <Link 
                href={`/cards?org=${org}`}
                className="btn btn-info"
              >
                📝 Manage Cards
              </Link>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}
