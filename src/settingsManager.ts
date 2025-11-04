import * as vscode from 'vscode';
import { DailyProgress } from './types';

export class SettingsManager {
  private static readonly SETTINGS_KEY = 'kioku.settings';
  private static readonly DAILY_PROGRESS_KEY = 'kioku.dailyProgress';
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Get daily new cards limit
   */
  getDailyNewCards(): number {
    return this.context.globalState.get('kioku.dailyNewCards', 30);
  }

  /**
   * Set daily new cards limit
   */
  async setDailyNewCards(limit: number): Promise<void> {
    // Ensure minimum limit of 5
    const validLimit = Math.max(5, limit);
    await this.context.globalState.update('kioku.dailyNewCards', validLimit);
  }

  /**
   * Get daily progress for a specific deck
   */
  getDailyProgress(deckId: string): DailyProgress | null {
    const allProgress = this.context.globalState.get<DailyProgress[]>(SettingsManager.DAILY_PROGRESS_KEY, []);
    const today = this.getTodayString();

    const progress = allProgress.find(p => p.deckId === deckId && p.date === today);
    return progress || null;
  }

  /**
   * Update daily progress for a specific deck
   */
  async updateDailyProgress(deckId: string, reviewedCount: number): Promise<void> {
    const allProgress = this.context.globalState.get<DailyProgress[]>(SettingsManager.DAILY_PROGRESS_KEY, []);
    const today = this.getTodayString();
    const dailyLimit = this.getDailyNewCards();

    // Remove old progress entries (older than today)
    const filteredProgress = allProgress.filter(p => p.date === today);

    // Find or create progress for this deck
    const existingIndex = filteredProgress.findIndex(p => p.deckId === deckId);

    if (existingIndex >= 0) {
      filteredProgress[existingIndex].reviewedCount = reviewedCount;
      filteredProgress[existingIndex].targetCount = dailyLimit;
    } else {
      filteredProgress.push({
        deckId,
        date: today,
        reviewedCount,
        targetCount: dailyLimit
      });
    }

    await this.context.globalState.update(SettingsManager.DAILY_PROGRESS_KEY, filteredProgress);
  }

  /**
   * Check if daily goal is completed for a deck
   */
  isDailyGoalCompleted(deckId: string): boolean {
    const progress = this.getDailyProgress(deckId);
    if (!progress) {
      return false;
    }
    return progress.reviewedCount >= progress.targetCount;
  }

  /**
   * Reset daily progress (for testing or manual reset)
   */
  async resetDailyProgress(): Promise<void> {
    await this.context.globalState.update(SettingsManager.DAILY_PROGRESS_KEY, []);
  }
}
