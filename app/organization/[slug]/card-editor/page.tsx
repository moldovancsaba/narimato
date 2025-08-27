'use client';

// FUNCTIONAL: Full CRUD operations for card management within organization context
// STRATEGIC: Organization-scoped card management with user-driven control

import { useState, useEffect } from 'react';
import { MinimalCSS } from '../../../lib/styles/minimal-design';

interface Props {
  params: { slug: string }
}

interface Card {
  uuid: string;
  name: string;
  type: string;
  content: string;
  isActive: boolean;
}

export default function CardEditor({ params }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'text',
    content: '',
    isActive: true
  });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch(`/api/v1/cards`, {
        headers: {
          'X-Organization-Slug': params.slug
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const url = editing 
      ? `/api/v1/cards/${editing}`
      : '/api/v1/cards';
    
    const method = editing ? 'PUT' : 'POST';
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Slug': params.slug
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchCards();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save card:', error);
    }
  };

  const handleEdit = (card: Card) => {
    setEditing(card.uuid);
    setFormData({
      name: card.name,
      type: card.type,
      content: card.content,
      isActive: card.isActive
    });
  };

  const handleDelete = async (uuid: string) => {
    if (confirm('Delete this card?')) {
      try {
        const response = await fetch(`/api/v1/cards/${uuid}`, {
          method: 'DELETE',
          headers: {
            'X-Organization-Slug': params.slug
          }
        });
        
        if (response.ok) {
          await fetchCards();
        }
      } catch (error) {
        console.error('Failed to delete card:', error);
      }
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      name: '',
      type: 'text',
      content: '',
      isActive: true
    });
  };

  if (loading) {
    return (
      <div className={MinimalCSS.centerContent}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className={MinimalCSS.container}>
      <h1 className={MinimalCSS.heading}>Card Management</h1>
      
      <form onSubmit={handleSubmit} className={MinimalCSS.form}>
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className={MinimalCSS.input}
            required
          />
        </div>
        
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
            className={MinimalCSS.input}
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
          </select>
        </div>
        
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>Content</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            className={MinimalCSS.textarea}
            required
          />
        </div>
        
        <div className={MinimalCSS.formField}>
          <label className={MinimalCSS.label}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
            />
            Active
          </label>
        </div>
        
        <div>
          <button type="submit" className={MinimalCSS.buttonPrimary}>
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button 
              type="button" 
              onClick={resetForm}
              className={MinimalCSS.buttonSecondary + ' ml-2'}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className={MinimalCSS.subheading}>Cards</h2>
      
      <div className={MinimalCSS.list}>
        {cards.map((card) => (
          <div key={card.uuid} className={MinimalCSS.listItem}>
            <div>
              <h3 className={MinimalCSS.subheading}>{card.name}</h3>
              <p>Type: {card.type}</p>
              <p>{card.content.substring(0, 100)}...</p>
              <p>Status: {card.isActive ? 'Active' : 'Inactive'}</p>
            </div>
            <div>
              <button 
                onClick={() => handleEdit(card)}
                className={MinimalCSS.buttonSecondary + ' mr-2'}
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(card.uuid)}
                className={MinimalCSS.buttonDanger}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8">
        <a href={`/organization/${params.slug}`} className={MinimalCSS.buttonSecondary}>
          Back to Organization
        </a>
      </div>
    </div>
  );
}
