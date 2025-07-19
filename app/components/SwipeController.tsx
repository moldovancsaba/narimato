// Migrated from root components directory
import { useSwipeStore } from '@/lib/store/swipeStore';
import { ICard } from '@/lib/types';

interface SwipeControllerProps {
  cards: ICard[];
}

export const SwipeController = ({ cards }: SwipeControllerProps) => {
  const { currentIndex, swipeLeft, swipeRight } = useSwipeStore();

  const handleSwipeLeft = () => {
    if (currentIndex < cards.length - 1) {
      swipeLeft();
    }
  };

  const handleSwipeRight = () => {
    if (currentIndex < cards.length - 1) {
      swipeRight();
    }
  };

  return (
    <div className="flex justify-center gap-4 mt-4">
      <button
        onClick={handleSwipeLeft}
        className="px-4 py-2 bg-red-500 text-white rounded-lg"
        disabled={currentIndex >= cards.length - 1}
      >
        Dislike
      </button>
      <button
        onClick={handleSwipeRight}
        className="px-4 py-2 bg-green-500 text-white rounded-lg"
        disabled={currentIndex >= cards.length - 1}
      >
        Like
      </button>
    </div>
  );
};
