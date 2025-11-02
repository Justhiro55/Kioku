/**
 * Card represents a single flashcard in the system
 */
export interface Card {
  id: string;
  front: string;
  back: string;
  tags: string[];
  created_at: string;
  due_at: string;
  interval: number;  // Days until next review
  reps: number;      // Number of repetitions
  ease: number;      // Ease factor for SM-2 algorithm
  deckId: string;
}

/**
 * Deck represents a collection of cards
 */
export interface Deck {
  id: string;
  name: string;
  card_ids: string[];
  created_at: string;
}

/**
 * User settings for the extension
 */
export interface UserSettings {
  storageType: "globalState" | "sqlite";
  spellMode: boolean;
  reviewAlgorithm: "sm2" | "basic";
  githubSync: boolean;
}

/**
 * Review result for SM-2 algorithm
 */
export interface ReviewResult {
  quality: number;  // 0-5 rating
  timestamp: string;
}
