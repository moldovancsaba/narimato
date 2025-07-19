import { ICard } from '@/lib/types';

interface CardContainerProps {
  card: ICard;
}

export const CardContainer = ({ card }: CardContainerProps) => {
  return (
    <div className="card" data-type={card.type}>
      <div className="card-content" data-type={card.type}>
        {card.type === 'image' ? (
          <img src={card.content} alt={card.imageAlt || card.title} />
        ) : (
          <>
            <h3 className="text-lg font-medium">{card.title}</h3>
            <p>{card.content}</p>
          </>
        )}
      </div>
    </div>
  );
};
