import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SwipeState {
  hasSwipedRight: boolean;
  isVotingUnlocked: boolean;
  addRightSwipe: () => void;
  resetSwipes: () => void;
}

export const useSwipeStore = create(
  persist<SwipeState>(
    (set) => ({
      hasSwipedRight: false,
      isVotingUnlocked: false,
      addRightSwipe: () =>
        set((state) => {
          // Only allow one right swipe
          if (state.hasSwipedRight) return state;
          
          return {
            hasSwipedRight: true,
            isVotingUnlocked: true,
          };
        }),
      resetSwipes: () =>
        set({
          hasSwipedRight: false,
          isVotingUnlocked: false,
        }),
    }),
    {
      name: 'swipe-storage',
    }
  )
);
