'use client'

import Link from 'next/link'
import { getCardUrl } from '@/app/middleware'

interface LeaderboardEntry {
  slug: string
  title: string
  content: string
  score: number
  rank?: number
  type: 'image' | 'text'
}

interface LeaderboardCardProps {
  entry: LeaderboardEntry
  showRank?: boolean
}

export default function LeaderboardCard({ entry, showRank = false }: LeaderboardCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link
            href={getCardUrl({ _id: entry.slug, slug: entry.slug })}
            className="text-lg font-semibold text-gray-900 hover:text-blue-600"
          >
            {entry.title}
          </Link>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{entry.content}</p>
        </div>
        {showRank && entry.rank && (
          <div className="ml-4 text-2xl font-bold text-gray-400">#{entry.rank}</div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">Score: {entry.score}</span>
        <span className={`px-2 py-1 rounded ${
          entry.type === 'image' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {entry.type}
        </span>
      </div>
    </div>
  )
}
