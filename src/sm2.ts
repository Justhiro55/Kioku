import { Card } from './types';

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm
 *
 * Quality scale:
 * 5 - perfect response
 * 4 - correct response after hesitation
 * 3 - correct response with difficulty
 * 2 - incorrect but remembered
 * 1 - incorrect, barely recalled
 * 0 - complete blackout
 */
export class SM2Algorithm {
  /**
   * Calculate next review date based on SM-2 algorithm
   */
  static calculateNextReview(card: Card, quality: number): Card {
    const now = new Date();

    // Quality should be 0-5
    if (quality < 0 || quality > 5) {
      throw new Error('Quality must be between 0 and 5');
    }

    let { interval, ease, reps } = card;

    // If quality < 3, reset the card
    if (quality < 3) {
      interval = 1;
      reps = 0;
    } else {
      // Update repetitions
      reps += 1;

      // Calculate interval
      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * ease);
      }

      // Update ease factor
      ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

      // Ease factor should not go below 1.3
      if (ease < 1.3) {
        ease = 1.3;
      }
    }

    // Calculate next due date
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + interval);

    return {
      ...card,
      interval,
      ease,
      reps,
      due_at: dueDate.toISOString()
    };
  }

  /**
   * Check if a card is due for review
   */
  static isDue(card: Card): boolean {
    const now = new Date();
    const dueDate = new Date(card.due_at);
    return dueDate <= now;
  }

  /**
   * Get cards that are due for review
   */
  static getDueCards(cards: Card[]): Card[] {
    return cards.filter(card => this.isDue(card));
  }
}
