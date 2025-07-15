import { ReactNode } from 'react';

interface CardContainerProps {
  children: ReactNode;
  cardType: 'image' | 'text';
  isList?: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
}

export function CardContainer({
  children,
  cardType,
  isList = false,
  onSwipe,
}: CardContainerProps) {
  const containerClasses = isList
    ? 'w-full h-full'
    : 'w-full max-w-md mx-auto my-8 aspect-[3/4]';

  return (
    <div 
      className={`${containerClasses} ${
        cardType === 'image' ? 'aspect-[3/4]' : 'aspect-auto'
      }`}
    >
      {children}
    </div>
  );
}
