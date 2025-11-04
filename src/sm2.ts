import { Card, CardState } from './types';

/**
 * Anki-style SM-2 Spaced Repetition Algorithm
 *
 * Quality scale (Anki-style):
 * 1 - Again (もう一度)
 * 2 - Hard (難しい) - Review cards only
 * 3 - Good (正解)
 * 4 - Easy (簡単)
 */

export class SM2Algorithm {
  // Learning steps in minutes
  private static readonly LEARNING_STEPS = [1, 10]; // 1分、10分
  private static readonly RELEARNING_STEPS = [10];   // 10分

  // Graduation intervals in days
  private static readonly GRADUATING_INTERVAL = 1;   // 卒業後1日
  private static readonly EASY_INTERVAL = 4;         // 簡単ボタン押下時4日

  // Lapse settings
  private static readonly MINIMUM_INTERVAL = 1;      // 忘却後の最小間隔
  private static readonly NEW_INTERVAL_MULTIPLIER = 0; // 忘却後の間隔倍率（0%）

  // Ease settings
  private static readonly STARTING_EASE = 2.5;       // 初期Ease (250%)
  private static readonly MINIMUM_EASE = 1.3;        // 最小Ease (130%)
  private static readonly EASY_BONUS = 1.3;          // 簡単ボーナス (130%)

  /**
   * Calculate next review based on quality rating
   */
  static calculateNextReview(card: Card, quality: number): Card {
    const now = new Date();

    // Validate quality
    if (quality < 1 || quality > 4) {
      throw new Error('Quality must be between 1 and 4');
    }

    let updatedCard = { ...card };
    updatedCard.lastReview = now.toISOString();

    // Handle based on card state
    if (card.state === CardState.NEW || card.state === CardState.LEARNING) {
      updatedCard = this.handleLearningCard(updatedCard, quality, now);
    } else if (card.state === CardState.RELEARNING) {
      updatedCard = this.handleRelearningCard(updatedCard, quality, now);
    } else if (card.state === CardState.REVIEW) {
      updatedCard = this.handleReviewCard(updatedCard, quality, now);
    }

    return updatedCard;
  }

  /**
   * Handle learning/new cards
   */
  private static handleLearningCard(card: Card, quality: number, now: Date): Card {
    const updatedCard = { ...card };
    updatedCard.state = CardState.LEARNING;

    if (quality === 1) {
      // Again: Go back to first step
      updatedCard.learningStep = 0;
      updatedCard.due_at = this.addMinutes(now, this.LEARNING_STEPS[0]).toISOString();
    } else if (quality === 4) {
      // Easy: Graduate immediately with easy interval
      updatedCard.state = CardState.REVIEW;
      updatedCard.interval = this.EASY_INTERVAL;
      updatedCard.ease = this.STARTING_EASE;
      updatedCard.reps = 1;
      updatedCard.due_at = this.addDays(now, this.EASY_INTERVAL).toISOString();
    } else {
      // Good (quality 3): Move to next step
      updatedCard.learningStep++;

      if (updatedCard.learningStep >= this.LEARNING_STEPS.length) {
        // Graduate to review card
        updatedCard.state = CardState.REVIEW;
        updatedCard.interval = this.GRADUATING_INTERVAL;
        updatedCard.ease = this.STARTING_EASE;
        updatedCard.reps = 1;
        updatedCard.due_at = this.addDays(now, this.GRADUATING_INTERVAL).toISOString();
      } else {
        // Move to next learning step
        const nextStepMinutes = this.LEARNING_STEPS[updatedCard.learningStep];
        updatedCard.due_at = this.addMinutes(now, nextStepMinutes).toISOString();
      }
    }

    return updatedCard;
  }

  /**
   * Handle relearning cards (forgotten review cards)
   */
  private static handleRelearningCard(card: Card, quality: number, now: Date): Card {
    const updatedCard = { ...card };

    if (quality === 1) {
      // Again: Go back to first relearning step
      updatedCard.learningStep = 0;
      updatedCard.due_at = this.addMinutes(now, this.RELEARNING_STEPS[0]).toISOString();
    } else if (quality === 4) {
      // Easy: Graduate back to review with easy bonus
      updatedCard.state = CardState.REVIEW;
      const newInterval = Math.max(this.MINIMUM_INTERVAL, Math.round(updatedCard.interval * this.EASY_BONUS));
      updatedCard.interval = newInterval;
      updatedCard.reps++;
      updatedCard.due_at = this.addDays(now, newInterval).toISOString();
    } else {
      // Good: Move to next relearning step or graduate
      updatedCard.learningStep++;

      if (updatedCard.learningStep >= this.RELEARNING_STEPS.length) {
        // Graduate back to review
        updatedCard.state = CardState.REVIEW;
        const newInterval = Math.max(this.MINIMUM_INTERVAL, updatedCard.interval);
        updatedCard.interval = newInterval;
        updatedCard.reps++;
        updatedCard.due_at = this.addDays(now, newInterval).toISOString();
      } else {
        // Move to next relearning step
        const nextStepMinutes = this.RELEARNING_STEPS[updatedCard.learningStep];
        updatedCard.due_at = this.addMinutes(now, nextStepMinutes).toISOString();
      }
    }

    return updatedCard;
  }

  /**
   * Handle review cards
   */
  private static handleReviewCard(card: Card, quality: number, now: Date): Card {
    const updatedCard = { ...card };
    let newInterval: number;
    let newEase = card.ease;

    if (quality === 1) {
      // Again: Move to relearning
      updatedCard.state = CardState.RELEARNING;
      updatedCard.learningStep = 0;
      updatedCard.lapses++;
      updatedCard.ease = Math.max(this.MINIMUM_EASE, newEase - 0.2);

      // Calculate new interval (minimum interval or percentage of old interval)
      newInterval = Math.max(
        this.MINIMUM_INTERVAL,
        Math.round(card.interval * this.NEW_INTERVAL_MULTIPLIER)
      );
      updatedCard.interval = newInterval;

      // Set due date to relearning step
      updatedCard.due_at = this.addMinutes(now, this.RELEARNING_STEPS[0]).toISOString();
    } else if (quality === 2) {
      // Hard: Reduce ease and use hard interval (1.2x current interval)
      newEase = Math.max(this.MINIMUM_EASE, card.ease - 0.15);
      newInterval = Math.round(card.interval * 1.2);

      updatedCard.ease = newEase;
      updatedCard.interval = newInterval;
      updatedCard.reps++;
      updatedCard.due_at = this.addDays(now, newInterval).toISOString();
    } else if (quality === 3) {
      // Good: Normal interval
      newInterval = Math.round(card.interval * card.ease);

      updatedCard.interval = newInterval;
      updatedCard.reps++;
      updatedCard.due_at = this.addDays(now, newInterval).toISOString();
    } else if (quality === 4) {
      // Easy: Increase ease and apply easy bonus
      newEase = card.ease + 0.15;
      newInterval = Math.round(card.interval * card.ease * this.EASY_BONUS);

      updatedCard.ease = newEase;
      updatedCard.interval = newInterval;
      updatedCard.reps++;
      updatedCard.due_at = this.addDays(now, newInterval).toISOString();
    }

    return updatedCard;
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
   * Get cards that are due for review (priority order)
   * 1. Learning/Relearning cards (due now)
   * 2. Review cards (due today or earlier)
   * 3. New cards (up to daily limit)
   */
  static getDueCards(cards: Card[], maxNewCards: number = 20): Card[] {
    const now = new Date();

    // Separate cards by state
    const learningCards = cards.filter(c =>
      (c.state === CardState.LEARNING || c.state === CardState.RELEARNING) &&
      this.isDue(c)
    );

    const reviewCards = cards.filter(c =>
      c.state === CardState.REVIEW &&
      this.isDue(c)
    );

    const newCards = cards
      .filter(c => c.state === CardState.NEW)
      .slice(0, maxNewCards);

    // Return in priority order
    return [...learningCards, ...reviewCards, ...newCards];
  }

  /**
   * Get card counts by state
   */
  static getCardCounts(cards: Card[]): {
    new: number;
    learning: number;
    review: number;
  } {
    const now = new Date();

    return {
      new: cards.filter(c => c.state === CardState.NEW).length,
      learning: cards.filter(c =>
        (c.state === CardState.LEARNING || c.state === CardState.RELEARNING) &&
        this.isDue(c)
      ).length,
      review: cards.filter(c =>
        c.state === CardState.REVIEW &&
        this.isDue(c)
      ).length
    };
  }

  /**
   * Initialize a new card with default values
   */
  static initializeCard(card: Partial<Card>): Card {
    const now = new Date();
    return {
      id: card.id || '',
      front: card.front || '',
      back: card.back || '',
      tags: card.tags || [],
      deckId: card.deckId || '',
      created_at: card.created_at || now.toISOString(),
      due_at: card.due_at || now.toISOString(),
      interval: 0,
      reps: 0,
      ease: this.STARTING_EASE,
      state: CardState.NEW,
      lapses: 0,
      learningStep: 0,
      image: card.image
    };
  }

  /**
   * Helper: Add minutes to date
   */
  private static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  /**
   * Helper: Add days to date
   */
  private static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
