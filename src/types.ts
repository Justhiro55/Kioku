/**
 * Card state enum (Anki-style)
 */
export enum CardState {
  NEW = 'new',              // 新規カード (未学習)
  LEARNING = 'learning',    // 学習中カード
  REVIEW = 'review',        // 復習カード (定着済み)
  RELEARNING = 'relearning' // 再学習中カード (忘却後)
}

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
  interval: number;       // Days until next review
  reps: number;           // Number of successful reviews
  ease: number;           // Ease factor (default: 2.5 = 250%)
  deckId: string;
  image?: string;         // Optional base64 image data

  // Anki-style properties
  state: CardState;       // Current card state
  lapses: number;         // Number of times forgotten
  learningStep: number;   // Current step in learning/relearning (0, 1, 2...)
  lastReview?: string;    // Last review timestamp
}

/**
 * Review mode for deck
 */
export type ReviewMode = 'normal' | 'spell';

/**
 * Deck represents a collection of cards
 */
export interface Deck {
  id: string;
  name: string;
  card_ids: string[];
  created_at: string;
  reviewMode?: ReviewMode; // Default: 'normal'
}

/**
 * Daily progress tracking for each deck
 */
export interface DailyProgress {
  deckId: string;
  date: string; // YYYY-MM-DD format
  reviewedCount: number;
  targetCount: number;
}

/**
 * User settings for the extension
 */
export interface UserSettings {
  storageType: "globalState" | "sqlite";
  spellMode: boolean;
  reviewAlgorithm: "sm2" | "basic";
  githubSync: boolean;
  dailyNewCards: number; // Number of new cards per day (default: 30)
}

/**
 * Review result for SM-2 algorithm
 */
export interface ReviewResult {
  quality: number;  // 0-5 rating
  timestamp: string;
}
