'use client'

import { useState } from 'react'

interface Card {
  id: string
  title: string
  description?: string
  order: number
}

interface CardManagerProps {
  cards: Card[]
  onOrderChange: (cards: Card[]) => void
}

export default function CardManager({ cards, onOrderChange }: CardManagerProps) {
  const [items, setItems] = useState(cards)

  const moveItem = (fromIndex: number, toIndex: number) => {
    const newItems = Array.from(items)
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)

    const updatedItems = newItems.map((item, index) => ({
      ...item,
      order: index,
    }))

    setItems(updatedItems)
    onOrderChange(updatedItems)
  }

  return (
    <div className="space-y-4">
      {items.map((card, index) => (
        <div
          key={card.id}
          className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h3 className="font-medium">{card.title}</h3>
          {card.description && (
            <p className="text-sm text-gray-500 mt-1">
              {card.description}
            </p>
          )}
          <div className="flex justify-end mt-2 space-x-2">
            {index > 0 && (
              <button
                onClick={() => moveItem(index, index - 1)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Move Up
              </button>
            )}
            {index < items.length - 1 && (
              <button
                onClick={() => moveItem(index, index + 1)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Move Down
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
