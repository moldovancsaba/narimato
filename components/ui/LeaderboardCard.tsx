'use client';

import { Paper, Typography, Box } from '@mui/material';
import type { LeaderboardEntry } from '@/lib/services/leaderboardService';
import Link from 'next/link';

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  showRank?: boolean;
}

export default function LeaderboardCard({
  entry,
  showRank = true,
}: LeaderboardCardProps) {
  return (
    <Link href={`/card/${entry.slug}`} className="block hover:no-underline">
      <Paper
        className="p-4 transition-all hover:shadow-md"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Rank display */}
        {showRank && (
          <Box
            sx={{
              minWidth: '3rem',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '1.25rem',
              color: entry.rank <= 3 ? 'primary.main' : 'text.secondary',
            }}
          >
            #{entry.rank}
          </Box>
        )}

        {/* Card preview */}
        <Box
          sx={{
            width: '80px',
            height: '80px',
            borderRadius: 1,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {entry.type === 'image' ? (
            <img
              src={entry.content}
              alt={entry.imageAlt || entry.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: '0.875rem',
                textAlign: 'center',
                p: 1,
              }}
            >
              {entry.title}
            </Box>
          )}
        </Box>

        {/* Card details */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="h3" className="line-clamp-1">
            {entry.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            className="line-clamp-2"
          >
            {entry.description}
          </Typography>
        </Box>

        {/* Stats */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 0.5,
          }}
        >
          <Typography variant="h6" color="primary">
            {entry.globalScore}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {entry.totalVotes} votes
          </Typography>
        </Box>
      </Paper>
    </Link>
  );
}
