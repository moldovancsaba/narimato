'use client'
import { useState, useEffect } from 'react'
import '../../../styles/minimal.css'

interface Props {
  params: { slug: string }
}

interface Card {
  uuid: string
  name: string
  content: string
  score?: number
}

export default function RanksPage({ params }: Props) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRanks()
  }, [])

  const fetchRanks = async () => {
    try {
      const response = await fetch(`/api/v1/ranking`, {
        headers: {
          'X-Organization-Slug': params.slug
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCards(data.cards || [])
      }
    } catch (error) {
      console.error('Failed to fetch ranks:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container text-center">Loading...</div>
  }

  if (cards.length === 0) {
    return (
      <div className="container text-center">
        <h1 className="mb-10">Ranks</h1>
        <div className="error mb-10">No Rankings</div>
        <button onClick={() => window.location.href = `/organization/${params.slug}/play`}>
          Play
        </button>
      </div>
    )
  }

  return (
    <div className="container">
      <h1 className="mb-20">Ranks</h1>
      
      <ul className="list">
        {cards.map((card, index) => (
          <li key={card.uuid} className="list-item">
            <div>
              <strong>#{index + 1} {card.name}</strong>
              <div>{card.content.substring(0, 50)}...</div>
              {card.score && <div>Score: {card.score}</div>}
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
