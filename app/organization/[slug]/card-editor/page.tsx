'use client'
import { useState, useEffect } from 'react'

interface Props {
  params: { slug: string }
}

interface Card {
  uuid: string
  name: string
  content: string
}

export default function CardEditor({ params }: Props) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    content: ''
  })

  useEffect(() => {
    fetchCards()
  }, [])

  const fetchCards = async () => {
    try {
      const response = await fetch(`/api/v1/cards`, {
        headers: {
          'X-Organization-Slug': params.slug
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCards(data.cards || [])
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const url = editing 
      ? `/api/v1/cards/${editing}`
      : '/api/v1/cards'
    
    const method = editing ? 'PUT' : 'POST'
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Slug': params.slug
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        await fetchCards()
        resetForm()
      }
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  const handleEdit = (card: Card) => {
    setEditing(card.uuid)
    setFormData({
      name: card.name,
      content: card.content
    })
  }

  const handleDelete = async (uuid: string) => {
    try {
      const response = await fetch(`/api/v1/cards/${uuid}`, {
        method: 'DELETE',
        headers: {
          'X-Organization-Slug': params.slug
        }
      })
      
      if (response.ok) {
        await fetchCards()
      }
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const resetForm = () => {
    setEditing(null)
    setFormData({
      name: '',
      content: ''
    })
  }

  if (loading) {
    return <div className="container text-center">Loading...</div>
  }

  return (
    <div className="container">
      <h1 className="mb-20">Cards</h1>
      
      <form onSubmit={handleSubmit} className="form mb-20">
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
        <textarea
          placeholder="Content"
          value={formData.content}
          onChange={(e) => setFormData({...formData, content: e.target.value})}
          required
        />
        <div className="form-row">
          <button type="submit">
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="list">
        {cards.map((card) => (
          <li key={card.uuid} className="list-item">
            <div>
              <strong>{card.name}</strong>
              <div>{card.content.substring(0, 100)}...</div>
            </div>
            <div className="actions">
              <button onClick={() => handleEdit(card)}>
                Edit
              </button>
              <button onClick={() => handleDelete(card.uuid)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      
      <button onClick={() => window.location.href = `/organization/${params.slug}`}>
        Back
      </button>
    </div>
  )
}
