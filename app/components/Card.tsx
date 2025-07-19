// Migrated from root components directory
import { ICard } from '@/lib/types';
import { CardContainer } from './ui/CardContainer';

interface CardProps {
  card: ICard;
}

export const Card = ({ card }: CardProps) => {
  return <CardContainer card={card} />;
};
