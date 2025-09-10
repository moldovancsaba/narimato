import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Cards() {
  const router = useRouter();
  const { org } = router.query;

  const [organizations, setOrganizations] = useState([]);
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    parentTag: '',
    // FUNCTIONAL: Optional ordering index within a parent deck (lower shows earlier)
    // STRATEGIC: Deterministic onboarding sequences without new endpoints/models
    sortIndex: '',
    isPlayable: true,
    // FUNCTIONAL: Whether this parent card's children should run as onboarding before any deck
    // STRATEGIC: Organization-wide intro using existing onboarding engine; default false to preserve legacy behavior
    isOnboarding: false
  });
  const [editingCard, setEditingCard] = useState(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (org) {
      fetchCards();
    }
  }, [org]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
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
      
      const includeHidden = router.query.includeHidden === 'true';
      const filtered = Object.entries(deckGroups)
        .filter(([tag, grpCards]) => grpCards.length >= 2)
        .filter(([tag]) => {
          const parent = data.cards.find(c => c.name === tag);
          if (!parent) return true; // fallback
          return includeHidden ? true : (parent.isPlayable !== false);
        });
      setDecks(filtered);
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
        setFormData({ title: '', description: '', imageUrl: '', parentTag: '', sortIndex: '', isPlayable: true, isOnboarding: false });
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
    console.log('🔧 Editing card:', card.title); // Debug log
    setEditingCard(card);
    setFormData({
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl,
      parentTag: card.parentTag || '',
      // FUNCTIONAL: Pre-fill ordering index as a string for input control
      // STRATEGIC: Simpler UX and avoids NaN rendering issues
      sortIndex: (typeof card.sortIndex === 'number') ? String(card.sortIndex) : '',
      isPlayable: typeof card.isPlayable === 'boolean' ? card.isPlayable : true,
      // FUNCTIONAL: Populate onboarding flag from existing card
      // STRATEGIC: Keeps UI state consistent with persisted data
      isOnboarding: typeof card.isOnboarding === 'boolean' ? card.isOnboarding : false
    });
    
    // Scroll to the edit form smoothly
    setTimeout(() => {
      const editForm = document.querySelector('h2');
      if (editForm) {
        editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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

  // Organization selection
  if (!org) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ marginBottom: '2rem' }}>
          {/* FUNCTIONAL: Standardize small back navigation button */}
          {/* STRATEGIC: Consistent back button size across all pages */}
          <Link href="/" className="btn btn-light btn-sm">← Back to Home</Link>
        </div>
        
        <h1>Cards - Select Organization</h1>
        
        {organizations.length === 0 ? (
          <div>
            <p>No organizations found.</p>
            <Link href="/organizations">Create an organization first</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {organizations.map(organization => (
              <div key={organization.uuid} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>{organization.name}</h3>
                <Link href={`/cards?org=${organization.uuid}`} className="btn btn-primary">
                  🎴 Manage Cards for This Organization
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading cards...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        {/* FUNCTIONAL: Standardize small back navigation button */}
        {/* STRATEGIC: Consistent back button size across all pages */}
        <Link href="/" className="btn btn-light btn-sm">← Back to Home</Link>
      </div>

      <h1>Cards Management</h1>
      <p style={{ color: '#666' }}>Organization: {org}</p>

      <div style={{ 
        marginBottom: '3rem', 
        padding: '1rem', 
        border: editingCard ? '2px solid #007bff' : '1px solid #ddd', 
        borderRadius: '4px',
        backgroundColor: editingCard ? '#f8f9ff' : 'white',
        boxShadow: editingCard ? '0 4px 12px rgba(0, 123, 255, 0.15)' : 'none'
      }}>
        <h2 style={{ 
          color: editingCard ? '#007bff' : '#333',
          fontSize: editingCard ? '1.5rem' : '1.25rem'
        }}>
          {editingCard ? '📝 Edit Card: "' + editingCard.title + '"' : 'Create New Card'}
        </h2>
        {editingCard && (
          <p style={{ 
            color: '#007bff', 
            fontSize: '0.9rem', 
            marginBottom: '1rem',
            fontStyle: 'italic'
          }}>
            💡 Editing card with UUID: {editingCard.uuid}
          </p>
        )}
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
          <select
            value={formData.parentTag}
            onChange={(e) => setFormData(prev => ({ ...prev, parentTag: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">🏠 Root Card (no parent)</option>
            {cards
              .filter(card => card.isParent && card.hasChildren)
              .map(parentCard => (
                <option key={parentCard.uuid} value={parentCard.name}>
                  📁 {parentCard.name.startsWith('#') ? parentCard.name.substring(1) : parentCard.name} ({parentCard.title})
                </option>
              ))
            }
            <optgroup label="All Available Cards">
              {cards.map(card => (
                <option key={`all-${card.uuid}`} value={card.name}>
                  📄 {card.name.startsWith('#') ? card.name.substring(1) : card.name} ({card.title})
                </option>
              ))}
            </optgroup>
          </select>

          {/* FUNCTIONAL: Optional ordering index for presentation within a parent deck */}
          {/* STRATEGIC: Enables deterministic onboarding sequences without heavy UI changes */}
          <input
            type="number"
            placeholder="Order (optional) — lower appears earlier"
            value={formData.sortIndex}
            onChange={(e) => setFormData(prev => ({ ...prev, sortIndex: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '-0.5rem' }}>
            Used when this card is part of an onboarding deck. Leave blank to fall back to creation time.
          </div>

          {/* FUNCTIONAL: Control whether a parent/root card's deck appears in selection lists */}
          {/* STRATEGIC: Hide internal decision-tree segments but still allow direct play via link */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={!!formData.isPlayable}
              onChange={(e) => setFormData(prev => ({ ...prev, isPlayable: e.target.checked }))}
            />
            Playable (public)
          </label>
          <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '-0.5rem' }}>
            If this is a parent card (root with children), this flag controls whether its deck appears in Play/Rankings lists. Hidden decks can still be played directly by link.
          </div>

          {/* FUNCTIONAL: Flag to use this parent's children as an onboarding segment before any selected deck */}
          {/* STRATEGIC: Reuses existing right-only onboarding engine; no new endpoints/models needed */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="checkbox"
              checked={!!formData.isOnboarding}
              onChange={(e) => setFormData(prev => ({ ...prev, isOnboarding: e.target.checked }))}
            />
            Onboarding
          </label>
          <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '-0.5rem' }}>
            Only affects parent/root cards with children. When enabled, this card’s children will run first as a short onboarding before the selected deck.
          </div>
          {editingCard && (
            (() => {
              const isRoot = !editingCard.parentTag;
              const childCount = cards.filter(c => c.parentTag === editingCard.name).length;
              const ineffective = !isRoot || childCount < 2;
              return (ineffective && formData.isOnboarding) ? (
                <div style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Onboarding has effect only for parent/root cards with at least 2 children; this setting will be ignored at runtime.
                </div>
              ) : null;
            })()
          )}
          <div className="btn-group btn-group-tight">
            {/* FUNCTIONAL: Elevate create action to large size; keep edit at mid */}
            {/* STRATEGIC: Primary creation CTAs should stand out; edits remain secondary */}
            <button type="submit" className={`btn btn-primary ${editingCard ? '' : 'btn-lg'}`}>
              {editingCard ? 'Update Card' : 'Create Card'}
            </button>
            {editingCard && (
              <button type="button" onClick={cancelEdit} className="btn btn-muted">
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
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#28a745' }}>
                  {tag.startsWith('#') ? tag.substring(1) : tag} ({deckCards.length} cards)
                  {(() => {
                    const includeHidden = router.query.includeHidden === 'true';
                    const parent = cards.find(c => c.name === tag);
                    const isHidden = parent && parent.isPlayable === false;
                    return includeHidden && isHidden ? (
                      <span style={{ marginLeft: '0.5rem', color: '#dc3545', fontSize: '0.85rem' }} title="Hidden deck (not publicly listed)">🙈 Hidden</span>
                    ) : null;
                  })()}
                </h3>
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
                <Link href={`/play?org=${org}`} className="btn btn-warning">
                  🎮 Play (choose deck & mode)
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2>All Cards ({cards.length})</h2>
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {cards.map(card => (
            <div key={card.uuid} className="card-with-info">
              <div className={`card card-md card-interactive ${card.imageUrl ? 'has-image' : ''}`}>
                <div className="card-title">{card.title}</div>
                {card.description && <div className="card-description">{card.description}</div>}
                {card.imageUrl && <img src={card.imageUrl} alt={card.title} className="card-image" />}
              </div>
              <div className="card-info">
              <div className="card-info-title">{card.name.startsWith('#') ? card.name.substring(1) : card.name}</div>
                <div className="card-info-meta">
                  {card.parentTag && (
                    <div style={{ color: '#28a745', marginBottom: '0.25rem' }}>
                      Deck: {card.parentTag.startsWith('#') ? card.parentTag.substring(1) : card.parentTag}
                    </div>
                  )}
                  <div style={{ marginBottom: '0.5rem' }}>
                    Score: {card.globalScore} • Votes: {card.voteCount}
                  </div>
                  <div className="btn-group btn-group-tight">
                    <button 
                      onClick={() => handleEdit(card)}
                      className="btn btn-info btn-sm"
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(card.uuid)}
                      className="btn btn-secondary btn-sm"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ textAlign: 'center', paddingTop: '2rem', marginTop: '2rem', borderTop: '1px solid #eee' }}>
        <div className="btn-group">
          <Link href={`/play?org=${org}`} className="btn btn-info">
            🎮 Play Decks
          </Link>
          <Link href={`/rankings?org=${org}`} className="btn btn-dark">
            🏆 View Rankings
          </Link>
        </div>
      </div>
    </div>
  );
}
