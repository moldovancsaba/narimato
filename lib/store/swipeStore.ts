import { create } from 'zustand';

interface SwipeState {
  currentIndex: number;
  swipeLeft: () => void;
  swipeRight: () => void;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set) => ({
  currentIndex: 0,
  swipeLeft: () => set((state) => ({ currentIndex: state.currentIndex + 1 })),
  swipeRight: () => set((state) => ({ currentIndex: state.currentIndex + 1 })),
  reset: () => set({ currentIndex: 0 }),
}));
