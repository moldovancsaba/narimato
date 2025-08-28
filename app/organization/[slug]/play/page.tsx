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
}

export default function PlayPage({ params }: Props) {
  const [cards, setCards] = useState<Card[]>([])
  const [currentCard, setCurrentCard] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [score, setScore] = useState(0)

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

  const startGame = () => {
    if (cards.length > 0) {
      setGameStarted(true)
      setScore(0)
      showRandomCard()
    }
  }

  const showRandomCard = () => {
    const randomIndex = Math.floor(Math.random() * cards.length)
    setCurrentCard(cards[randomIndex])
  }

  const nextCard = () => {
    setScore(score + 1)
    showRandomCard()
  }

  const endGame = () => {
    setGameStarted(false)
    setCurrentCard(null)
  }

  if (loading) {
    return <div className="container text-center">Loading...</div>
  }

  if (cards.length === 0) {
    return (
      <div className="container text-center">
        <div className="error mb-10">No Cards</div>
        <button onClick={() => window.location.href = `/organization/${params.slug}/card-editor`}>
          Create Cards
        </button>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className="container text-center">
        <h1 className="mb-10">Play</h1>
        <div className="mb-10">{cards.length} cards</div>
        <div className="form">
          <button onClick={startGame}>
            Start
          </button>
          <button onClick={() => window.location.href = `/organization/${params.slug}`}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container text-center">
      <div className="mb-10">Score: {score}</div>
      
      {currentCard && (
        <div className="mb-20">
          <h2 className="mb-10">{currentCard.name}</h2>
          <div className="mb-10">{currentCard.content}</div>
        </div>
      )}
      
      <div className="form">
        <button onClick={nextCard}>
          Next
        </button>
        <button onClick={endGame}>
          End
        </button>
      </div>
    </div>
  )
}
