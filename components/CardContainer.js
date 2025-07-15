/**
 * CardContainer Component
 * Follows narimato.md container rules:
 * - Manages all styling for contained cards
 * - Uses w-[min(100vw,500px)] for adaptive width
 * - Handles aspect ratios: 3:4 for text, original for images
 * - No per-component styles, only Tailwind utilities
 */
export default function CardContainer({ children }) {
  return (
    <div className="w-[min(100vw,500px)] h-full relative rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 bg-white dark:bg-gray-800">
      {children}
    </div>
  );
}
