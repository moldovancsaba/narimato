'use client';

import { useEffect, useState } from 'react';
import { ICard } from '@/models/Card';
import Image from 'next/image';
import { Chip, Box, Typography, Paper } from '@mui/material';

export default function CardPage({ params }: { params: { slug: string } }) {
  const [card, setCard] = useState<ICard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCard = async () => {
      try {
        const response = await fetch(`/api/cards/${params.slug}`);
        if (!response.ok) {
          throw new Error('Failed to fetch card');
        }
        const data = await response.json();
        setCard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    fetchCard();
  }, [params.slug]);

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-8"></div>
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Paper className="max-w-2xl mx-auto p-6">
        <Typography variant="h4" component="h1" gutterBottom>
          {card.title}
        </Typography>

        {card.description && (
          <Typography variant="body1" color="text.secondary" paragraph>
            {card.description}
          </Typography>
        )}

        {card.type === 'image' ? (
          <div className="relative aspect-video mb-4 rounded-lg overflow-hidden">
            <Image
              src={card.content}
              alt={card.imageAlt || card.title}
              fill
              className="object-contain"
            />
          </div>
        ) : (
          <Typography variant="body1" paragraph>
            {card.content}
          </Typography>
        )}

        {card.hashtags && card.hashtags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            {card.hashtags.map((tag) => (
              <Chip key={tag} label={tag} variant="outlined" />
            ))}
          </Box>
        )}

        <Box sx={{ mt: 4, color: 'text.secondary', fontSize: 'small' }}>
          <div>Created: {new Date(card.createdAt).toLocaleString()}</div>
          {card.updatedAt !== card.createdAt && (
            <div>Updated: {new Date(card.updatedAt).toLocaleString()}</div>
          )}
        </Box>
      </Paper>
    </div>
  );
}
