import { v5 as uuidv5 } from 'uuid';

/**
 * Generates consistent UUIDs for decks based on their configuration.
 * Same deck configuration will always produce the same UUID.
 * This allows us to identify when the same deck is being played multiple times.
 */

// Namespace UUID for deck generation (randomly generated constant)
const DECK_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generates a consistent UUID for a deck based on its tag and card composition.
 * @param deckTag - The selected deck tag (e.g., 'all', 'react', 'javascript')
 * @param cardUuids - Array of card UUIDs in the deck (should be sorted for consistency)
 * @returns A consistent UUID for this deck configuration
 */
export function generateDeckUuid(deckTag: string, cardUuids: string[]): string {
  // Sort card UUIDs to ensure consistent ordering regardless of input order
  const sortedCardUuids = [...cardUuids].sort();
  
  // Create a deterministic string representation of the deck
  const deckString = `${deckTag}:${sortedCardUuids.join(',')}`;
  
  // Generate UUID v5 based on the deck configuration
  return uuidv5(deckString, DECK_NAMESPACE);
}

/**
 * Validates if a deck UUID matches the given deck configuration.
 * @param deckUuid - The UUID to validate
 * @param deckTag - The deck tag
 * @param cardUuids - Array of card UUIDs
 * @returns True if the UUID matches the configuration
 */
export function validateDeckUuid(deckUuid: string, deckTag: string, cardUuids: string[]): boolean {
  const expectedUuid = generateDeckUuid(deckTag, cardUuids);
  return deckUuid === expectedUuid;
}

/**
 * Extracts deck information from stored plays for analysis.
 * @param deckUuid - The deck UUID to analyze
 * @returns Metadata about the deck if available
 */
export function getDeckMetadata(deckUuid: string): { 
  deckUuid: string;
  // Add more metadata fields as needed
} {
  return {
    deckUuid
  };
}
