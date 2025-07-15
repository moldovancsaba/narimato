import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function that combines Tailwind CSS classes using clsx and tailwind-merge.
 * This ensures proper merging of Tailwind utility classes without conflicts.
 * 
 * @param inputs - Array of class values to be merged
 * @returns A string of merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
