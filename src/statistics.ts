import * as vscode from 'vscode';

/**
 * Review session record
 */
export interface ReviewSession {
  id: string;
  date: string; // ISO date string
  cards_reviewed: number;
  cards_correct: number;
  duration_seconds: number;
  timestamp: string; // ISO timestamp
}

/**
 * Statistics data
 */
export interface Statistics {
  total_cards: number;
  total_reviews: number;
  total_review_sessions: number;
  streak_days: number;
  reviews_by_date: { [date: string]: number };
  accuracy_rate: number;
  average_interval: number;
}

/**
 * Manages review session history and statistics
 */
export class StatisticsManager {
  private static readonly SESSIONS_KEY = 'kioku.sessions';

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Record a review session
   */
  async recordSession(session: Omit<ReviewSession, 'id' | 'timestamp'>): Promise<void> {
    const sessions = await this.getSessions();

    const newSession: ReviewSession = {
      ...session,
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    sessions.push(newSession);
    await this.context.globalState.update(StatisticsManager.SESSIONS_KEY, sessions);
  }

  /**
   * Get all review sessions
   */
  async getSessions(): Promise<ReviewSession[]> {
    return this.context.globalState.get<ReviewSession[]>(StatisticsManager.SESSIONS_KEY, []);
  }

  /**
   * Get sessions for a specific date
   */
  async getSessionsByDate(date: string): Promise<ReviewSession[]> {
    const sessions = await this.getSessions();
    return sessions.filter(s => s.date === date);
  }

  /**
   * Get reviews by date (for calendar visualization)
   */
  async getReviewsByDate(): Promise<{ [date: string]: number }> {
    const sessions = await this.getSessions();
    const reviewsByDate: { [date: string]: number } = {};

    sessions.forEach(session => {
      if (!reviewsByDate[session.date]) {
        reviewsByDate[session.date] = 0;
      }
      reviewsByDate[session.date] += session.cards_reviewed;
    });

    return reviewsByDate;
  }

  /**
   * Calculate current streak
   */
  async getStreak(): Promise<number> {
    const reviewsByDate = await this.getReviewsByDate();
    const dates = Object.keys(reviewsByDate).sort().reverse();

    if (dates.length === 0) {
      return 0;
    }

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const checkDate = new Date(today);

    // Check if reviewed today or yesterday (allow 1 day gap)
    const lastReviewDate = dates[0];
    const daysSinceLastReview = this.daysBetween(lastReviewDate, today);

    if (daysSinceLastReview > 1) {
      return 0;
    }

    // Count consecutive days
    for (const date of dates) {
      const dateStr = checkDate.toISOString().split('T')[0];

      if (date === dateStr) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get total statistics
   */
  async getStatistics(totalCards: number): Promise<Statistics> {
    const sessions = await this.getSessions();
    const reviewsByDate = await this.getReviewsByDate();
    const streak = await this.getStreak();

    let totalReviews = 0;
    let totalCorrect = 0;
    const totalInterval = 0;
    const intervalCount = 0;

    sessions.forEach(session => {
      totalReviews += session.cards_reviewed;
      totalCorrect += session.cards_correct;
    });

    const accuracyRate = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

    return {
      total_cards: totalCards,
      total_reviews: totalReviews,
      total_review_sessions: sessions.length,
      streak_days: streak,
      reviews_by_date: reviewsByDate,
      accuracy_rate: Math.round(accuracyRate * 10) / 10,
      average_interval: intervalCount > 0 ? Math.round((totalInterval / intervalCount) * 10) / 10 : 0
    };
  }

  /**
   * Get statistics for the last N days
   */
  async getRecentStats(days: number = 30): Promise<{ date: string; reviews: number }[]> {
    const reviewsByDate = await this.getReviewsByDate();
    const stats: { date: string; reviews: number }[] = [];

    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      stats.push({
        date: dateStr,
        reviews: reviewsByDate[dateStr] || 0
      });
    }

    return stats;
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Clear all statistics (for testing)
   */
  async clearStatistics(): Promise<void> {
    await this.context.globalState.update(StatisticsManager.SESSIONS_KEY, []);
  }
}
