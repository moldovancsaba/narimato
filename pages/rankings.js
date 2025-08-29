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
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: '#0070f3' }}>← Back to Home</Link>
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
              style={{
                padding: '0.5rem 1rem',
                background: org === organization.uuid ? '#0070f3' : '#f8f9fa',
                color: org === organization.uuid ? 'white' : '#333',
                textDecoration: 'none',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
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
                style={{
                  padding: '0.5rem 1rem',
                  background: selectedDeck === 'all' ? '#28a745' : '#f8f9fa',
                  color: selectedDeck === 'all' ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                All Decks ({rankings.length})
              </button>
              {decks.map(deckInfo => (
                <button
                  key={deckInfo.tag}
                  onClick={() => handleDeckChange(deckInfo.tag)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: selectedDeck === deckInfo.tag ? '#28a745' : '#f8f9fa',
                    color: selectedDeck === deckInfo.tag ? 'white' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
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
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    background: '#0070f3', 
                    color: 'white', 
                    textDecoration: 'none', 
                    borderRadius: '4px'
                  }}
                >
                  🎮 Start Playing
                </Link>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                {/* Header */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 120px 100px 100px 80px', 
                  gap: '1rem', 
                  padding: '1rem', 
                  background: '#f8f9fa', 
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  borderBottom: '1px solid #ddd'
                }}>
                  <div>Rank</div>
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
                        gridTemplateColumns: '60px 1fr 120px 100px 100px 80px', 
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

                      {/* Card */}
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
                🎮 Play & Vote
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
        </>
      )}
    </div>
  );
}
