import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Cards() {
  const router = useRouter();
  const { org } = router.query;

  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    parentTag: ''
  });
  const [editingCard, setEditingCard] = useState(null);

  useEffect(() => {
    if (org) {
      fetchCards();
    }
  }, [org]);

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards?organizationId=${org}`);
      const data = await res.json();
      setCards(data.cards || []);
      
      // Group decks
      const deckGroups = {};
      data.cards?.forEach(card => {
        if (card.parentTag) {
          if (!deckGroups[card.parentTag]) {
            deckGroups[card.parentTag] = [];
          }
          deckGroups[card.parentTag].push(card);
        }
      });
      
      setDecks(Object.entries(deckGroups).filter(([tag, cards]) => cards.length >= 2));
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingCard !== null;
      const url = isEditing ? `/api/cards/${editingCard.uuid}` : '/api/cards';
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, organizationId: org })
      });
      
      if (res.ok) {
        setFormData({ title: '', description: '', imageUrl: '', parentTag: '' });
        setEditingCard(null);
        fetchCards();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to save card:', error);
      alert('Failed to save card');
    }
  };
  
  const handleEdit = (card) => {
    setEditingCard(card);
    setFormData({
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl,
      parentTag: card.parentTag || ''
    });
  };
  
  const handleDelete = async (cardUuid) => {
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    try {
      const res = await fetch(`/api/cards/${cardUuid}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        fetchCards();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
      alert('Failed to delete card');
    }
  };
  
  const cancelEdit = () => {
    setEditingCard(null);
    setFormData({ title: '', description: '', imageUrl: '', parentTag: '' });
  };

  if (!org) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Please select an organization first.</p>
        <Link href="/organizations">Go to Organizations</Link>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading cards...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: '#0070f3' }}>← Back to Home</Link>
      </div>

      <h1>Cards Management</h1>
      <p style={{ color: '#666' }}>Organization: {org}</p>

      <div style={{ marginBottom: '3rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>{editingCard ? 'Edit Card' : 'Create New Card'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Card Title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
          />
          <input
            type="url"
            placeholder="Image URL (optional)"
            value={formData.imageUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Parent Hashtag (e.g., #food) - leave empty for root cards"
            value={formData.parentTag}
            onChange={(e) => setFormData(prev => ({ ...prev, parentTag: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {editingCard ? 'Update Card' : 'Create Card'}
            </button>
            {editingCard && (
              <button type="button" onClick={cancelEdit} style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h2>Playable Decks ({decks.length})</h2>
        {decks.length === 0 ? (
          <p style={{ color: '#666' }}>No playable decks yet. Create cards with the same parent hashtag to form decks.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {decks.map(([tag, deckCards]) => (
              <div key={tag} style={{ padding: '1rem', border: '2px solid #28a745', borderRadius: '4px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#28a745' }}>{tag} ({deckCards.length} cards)</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {deckCards.slice(0, 3).map(card => (
                    <div key={card.uuid} style={{ padding: '0.25rem 0.5rem', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {card.title}
                    </div>
                  ))}
                  {deckCards.length > 3 && (
                    <div style={{ padding: '0.25rem 0.5rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.75rem' }}>
                      +{deckCards.length - 3} more
                    </div>
                  )}
                </div>
                <Link href={`/play?org=${org}&deck=${encodeURIComponent(tag)}`} style={{ padding: '0.5rem 1rem', background: '#ffc107', color: 'black', textDecoration: 'none', borderRadius: '4px' }}>
                  Play This Deck
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2>All Cards ({cards.length})</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {cards.map(card => (
            <div key={card.uuid} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>{card.title}</h4>
              <p style={{ color: '#666', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>{card.name}</p>
              {card.parentTag && (
                <p style={{ color: '#28a745', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                  Deck: {card.parentTag}
                </p>
              )}
              {card.description && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>{card.description}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                <span>Score: {card.globalScore}</span>
                <span>Votes: {card.voteCount}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleEdit(card)}
                  style={{ padding: '0.25rem 0.5rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(card.uuid)}
                  style={{ padding: '0.25rem 0.5rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ textAlign: 'center', paddingTop: '2rem', marginTop: '2rem', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link 
            href={`/play?org=${org}`}
            style={{ 
              padding: '0.5rem 1rem', 
              background: '#0070f3', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '4px'
            }}
          >
            🎮 Play Decks
          </Link>
          <Link 
            href={`/rankings?org=${org}`}
            style={{ 
              padding: '0.5rem 1rem', 
              background: '#6f42c1', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '4px'
            }}
          >
            🏆 View Rankings
          </Link>
        </div>
      </div>
    </div>
  );
}
