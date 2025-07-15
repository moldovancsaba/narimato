'use client';

import dynamic from 'next/dynamic';

const CardList = dynamic(() => import('./CardList'), { ssr: false });

interface Card {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'image';
  order: number;
}

interface CardListWrapperProps {
  project: {
    cards: Card[];
  };
  reorderCards: (cardIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

export default function CardListWrapper(props: CardListWrapperProps) {
  return <CardList {...props} />;
}
