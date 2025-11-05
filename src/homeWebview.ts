import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';
import { StatisticsManager } from './statistics';
import { SettingsManager } from './settingsManager';
import { Card, Deck, CardState, ReviewMode } from './types';
import { v4 as uuidv4 } from 'uuid';

interface WebviewMessage {
  command: string;
  deckId?: string;
  cardId?: string;
  front?: string;
  back?: string;
  tags?: string;
  dailyLimit?: number;
  reviewMode?: ReviewMode;
}

interface DeckStat {
  id: string;
  name: string;
  totalCards: number;
  dueCards: number;
  newCards: number;        // 🔵 新規カード数
  learningCards: number;   // 🔴 学習中カード数
  reviewCards: number;     // 🟢 復習カード数
  reviewMode: ReviewMode;  // 復習モード
  dailyProgress?: {
    reviewedCount: number;
    targetCount: number;
    isCompleted: boolean;
  };
}

interface RecentStat {
  date: string;
  reviews: number;
}

interface Stats {
  total_cards: number;
  total_reviews: number;
  streak_days: number;
}

export class HomeWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private statisticsManager: StatisticsManager;
  private settingsManager: SettingsManager;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private onStartReview: (deckId?: string) => void,
    private onShowStats?: () => void,
    private onImportDeck?: () => void
  ) {
    this.statisticsManager = new StatisticsManager(context);
    this.settingsManager = new SettingsManager(context);
  }

  async show() {
    this.panel = vscode.window.createWebviewPanel(
      'kiokuHome',
      'Kioku Home',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    await this.updateWebview();
  }

  async refresh() {
    if (this.panel) {
      await this.updateWebview();
    }
  }

  private async handleMessage(message: WebviewMessage) {
    if (message.command === 'startReview') {
      this.onStartReview(message.deckId);
      if (this.panel) {
        this.panel.dispose();
      }
    } else if (message.command === 'showStats') {
      if (this.onShowStats) {
        this.onShowStats();
      }
    } else if (message.command === 'importDeck') {
      if (this.onImportDeck) {
        this.onImportDeck();
      }
    } else if (message.command === 'viewDeck' && message.deckId) {
      await this.showDeckBrowser(message.deckId);
    } else if (message.command === 'addCard' && message.deckId) {
      await this.showAddCard(message.deckId);
    } else if (message.command === 'closeModal') {
      await this.updateWebview();
    } else if (message.command === 'deleteCard' && message.cardId && message.deckId) {
      await this.deleteCard(message.cardId);
      await this.showDeckBrowser(message.deckId);
    } else if (message.command === 'saveNewCard' && message.deckId && message.front && message.back) {
      await this.saveNewCard(message.deckId, message.front, message.back);
      await this.showDeckBrowser(message.deckId);
    } else if (message.command === 'updateDailyLimit' && message.dailyLimit !== undefined) {
      await this.settingsManager.setDailyNewCards(message.dailyLimit);
      await this.updateWebview();
    } else if (message.command === 'toggleDeckReviewMode' && message.deckId && message.reviewMode) {
      await this.storage.updateDeckReviewMode(message.deckId, message.reviewMode);
      await this.updateWebview();
    }
  }

  private async showDeckBrowser(deckId: string) {
    if (!this.panel) {
      return;
    }

    const deck = (await this.storage.getDecks()).find(d => d.id === deckId);
    if (!deck) {
      return;
    }

    const cards = await this.storage.getCardsByDeck(deckId);
    this.panel.webview.html = this.getDeckBrowserContent(deck, cards);
  }

  private async showAddCard(deckId: string) {
    if (!this.panel) {
      return;
    }

    const deck = (await this.storage.getDecks()).find(d => d.id === deckId);
    if (!deck) {
      return;
    }

    this.panel.webview.html = this.getAddCardContent(deck);
  }

  private async deleteCard(cardId: string) {
    await this.storage.deleteCard(cardId);
  }

  private async saveNewCard(deckId: string, front: string, back: string) {
    // Use SM2Algorithm to initialize card with proper defaults
    const newCard: Card = SM2Algorithm.initializeCard({
      id: uuidv4(),
      front,
      back,
      tags: [],
      deckId: deckId
    });

    // Add card to deck
    const deck = (await this.storage.getDecks()).find(d => d.id === deckId);
    if (deck) {
      deck.card_ids.push(newCard.id);
      await this.storage.saveDeck(deck);
    }

    // Save card
    const allCards = await this.storage.getCards();
    allCards.push(newCard);
    await this.context.globalState.update('cards', allCards);

    // Refresh home screen if returning to it
    await this.refresh();
  }

  private async updateWebview() {
    if (!this.panel) {
      return;
    }

    const decks = await this.storage.getDecks();
    const allCards = await this.storage.getCards();

    // Get daily limit for new cards
    const dailyLimit = this.settingsManager.getDailyNewCards();

    // Calculate stats for each deck
    const deckStats = await Promise.all(decks.map(async (deck) => {
      const deckCards = await this.storage.getCardsByDeck(deck.id);

      // Get due cards considering daily limit
      const dueCards = SM2Algorithm.getDueCards(deckCards, dailyLimit);

      // Count cards by state within the daily limit
      let learningCount = 0;
      let reviewCount = 0;
      let newCount = 0;

      for (const card of dueCards) {
        if (card.state === CardState.LEARNING || card.state === CardState.RELEARNING) {
          learningCount++;
        } else if (card.state === CardState.REVIEW) {
          reviewCount++;
        } else if (card.state === CardState.NEW) {
          newCount++;
        }
      }

      // Get daily progress for this deck
      const progress = this.settingsManager.getDailyProgress(deck.id);
      const dailyProgress = progress ? {
        reviewedCount: progress.reviewedCount,
        targetCount: progress.targetCount,
        isCompleted: this.settingsManager.isDailyGoalCompleted(deck.id)
      } : undefined;

      return {
        id: deck.id,
        name: deck.name,
        totalCards: deckCards.length,
        dueCards: dueCards.length,
        newCards: newCount,
        learningCards: learningCount,
        reviewCards: reviewCount,
        reviewMode: deck.reviewMode || 'normal',
        dailyProgress
      };
    }));

    // Calculate total due cards with daily limit
    const totalDue = SM2Algorithm.getDueCards(allCards, dailyLimit).length;

    // Get calendar data
    const recentStats = await this.statisticsManager.getRecentStats(90);
    const stats = await this.statisticsManager.getStatistics(allCards.length);

    this.panel.webview.html = this.getWebviewContent(deckStats, totalDue, recentStats, stats, dailyLimit);
  }

  private getWebviewContent(deckStats: DeckStat[], totalDue: number, recentStats: RecentStat[], stats: Stats, dailyLimit: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kioku Home</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    h1 {
      font-size: 48px;
      margin-bottom: 10px;
    }

    .subtitle {
      font-size: 18px;
      color: var(--vscode-descriptionForeground);
    }

    .controls-section {
      max-width: 700px;
      margin: 0 auto 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .control-card {
      padding: 20px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      transition: all 0.2s;
    }

    .control-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }

    .control-card-title {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .settings-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .limit-btn {
      width: 36px;
      height: 36px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 20px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .limit-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: scale(1.1);
    }

    .limit-btn:active {
      transform: scale(0.95);
    }

    .limit-value {
      min-width: 60px;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: var(--vscode-foreground);
    }

    .import-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      color: white;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .import-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .import-icon {
      font-size: 18px;
    }

    .footer {
      max-width: 800px;
      margin: 60px auto 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-input-border);
      text-align: center;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }

    .footer a:hover {
      color: #764ba2;
      text-decoration: underline;
    }

    .decks-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 20px;
      margin-bottom: 20px;
      color: var(--vscode-descriptionForeground);
    }

    .deck-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
    }

    .deck-card {
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 24px;
      transition: all 0.3s;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .deck-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transform: scaleX(0);
      transition: transform 0.3s;
    }

    .deck-card:hover::before {
      transform: scaleX(1);
    }

    .deck-card:hover {
      border-color: #667eea;
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
    }

    .deck-card.no-due {
      opacity: 0.8;
    }

    .deck-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
      padding: 0 4px;
    }

    .deck-icon {
      font-size: 40px;
      line-height: 1;
      margin-left: 1px;
    }

    .deck-mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 14px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
      white-space: nowrap;
      margin-right: 1px;
    }

    .deck-mode-badge:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
    }

    .deck-name {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 14px;
      line-height: 1.3;
      text-align: center;
    }

    .deck-stats {
      display: flex;
      gap: 8px;
      justify-content: center;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 15px;
      flex-wrap: wrap;
    }

    .deck-stats span {
      background: var(--vscode-input-background);
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .deck-due {
      font-weight: bold;
      color: var(--vscode-button-background);
    }

    .deck-done {
      color: #28a745;
      font-weight: bold;
    }

    .deck-progress {
      margin: 10px 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .progress-bar-container {
      width: 100%;
      height: 6px;
      background: var(--vscode-input-border);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 5px;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-bar.completed {
      background: linear-gradient(90deg, #28a745, #20c997);
    }

    .daily-completed-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: rgba(40, 167, 69, 0.15);
      color: #28a745;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }

    .deck-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: auto;
    }

    .deck-action-btn {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .deck-action-btn.view {
      background: rgba(102, 126, 234, 0.15);
      color: #667eea;
    }

    .deck-action-btn.view:hover {
      background: rgba(102, 126, 234, 0.25);
      transform: translateY(-2px);
    }

    .deck-action-btn.add {
      background: rgba(40, 167, 69, 0.15);
      color: #28a745;
    }

    .deck-action-btn.add:hover {
      background: rgba(40, 167, 69, 0.25);
      transform: translateY(-2px);
    }

    .deck-action-btn.review {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .deck-action-btn.review:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .empty-state-text {
      font-size: 18px;
      margin-bottom: 20px;
    }

    .empty-state-hint {
      font-size: 14px;
      opacity: 0.8;
    }

    .stats-section {
      max-width: 800px;
      margin: 40px auto;
      padding: 30px;
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 12px;
    }

    .stats-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .stats-title {
      font-size: 20px;
      font-weight: bold;
    }

    .stats-button {
      padding: 10px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .stats-button:hover {
      background: var(--vscode-button-hoverBackground);
      transform: translateY(-2px);
    }

    .calendar-container {
      margin-top: 20px;
    }

    .calendar-months {
      display: flex;
      gap: 10px;
      margin-bottom: 5px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding-left: 20px;
    }

    .calendar-month {
      min-width: 50px;
    }

    .calendar-body {
      display: flex;
      gap: 3px;
    }

    .calendar-days {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      justify-content: space-around;
      padding-right: 5px;
    }

    .calendar {
      display: grid;
      grid-template-columns: repeat(13, 1fr);
      gap: 3px;
      flex: 1;
    }

    .week {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .day {
      width: 13px;
      height: 13px;
      border-radius: 2px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      cursor: pointer;
      position: relative;
    }

    .day:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 10px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      white-space: nowrap;
      font-size: 11px;
      z-index: 10;
      margin-bottom: 5px;
    }

    .day[data-level="1"] {
      background: #0e4429;
    }

    .day[data-level="2"] {
      background: #006d32;
    }

    .day[data-level="3"] {
      background: #26a641;
    }

    .day[data-level="4"] {
      background: #39d353;
    }

    .calendar-legend {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 15px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧠 Kioku</h1>
    <p class="subtitle">Your flashcard learning companion</p>
  </div>

  <div class="controls-section">
    <div class="control-card">
      <div class="control-card-title">📊 Daily Review Limit</div>
      <div class="settings-controls">
        <button class="limit-btn" onclick="updateDailyLimit(${dailyLimit - 5})">−</button>
        <div class="limit-value">${dailyLimit}</div>
        <button class="limit-btn" onclick="updateDailyLimit(${dailyLimit + 5})">+</button>
      </div>
    </div>

    <div class="control-card">
      <div class="control-card-title">📥 Import Deck</div>
      <button class="import-btn" onclick="importDeck()">
        <span class="import-icon">📄</span>
        <span>Import from Markdown</span>
      </button>
    </div>
  </div>

  <div class="decks-container">
    ${deckStats.length > 0 ? `
      <h2 class="section-title">Your Decks</h2>
      <div class="deck-grid">
        ${deckStats.map(deck => `
          <div class="deck-card ${deck.dueCards === 0 ? 'no-due' : ''}">
            <div class="deck-top">
              <div class="deck-icon">${deck.dueCards > 0 ? '📖' : '✅'}</div>
              <div class="deck-mode-badge" onclick="toggleDeckMode('${deck.id}', '${deck.reviewMode === 'normal' ? 'spell' : 'normal'}'); event.stopPropagation();" title="Click to toggle">
                ${deck.reviewMode === 'spell' ? '⌨️ Spell' : '👁️ Normal'}
              </div>
            </div>
            <div class="deck-name">${this.escapeHtml(deck.name)}</div>
            <div class="deck-stats">
              <span>🔵 ${deck.newCards} 新規</span>
              <span>🔴 ${deck.learningCards} 学習中</span>
              <span>🟢 ${deck.reviewCards} 復習</span>
            </div>
            ${deck.dailyProgress ? `
              <div class="deck-progress">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>${deck.dailyProgress.reviewedCount} / ${deck.dailyProgress.targetCount} 今日の進捗</span>
                  <span>${Math.round((deck.dailyProgress.reviewedCount / deck.dailyProgress.targetCount) * 100)}%</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar ${deck.dailyProgress.isCompleted ? 'completed' : ''}"
                       style="width: ${Math.min((deck.dailyProgress.reviewedCount / deck.dailyProgress.targetCount) * 100, 100)}%">
                  </div>
                </div>
                ${deck.dailyProgress.isCompleted ? `
                  <div class="daily-completed-badge">
                    <span>✓</span>
                    <span>今日の目標達成</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            <div class="deck-actions">
              ${deck.dueCards > 0 ? `
                <button class="deck-action-btn review" onclick="startReview('${deck.id}'); event.stopPropagation();">
                  <span>▶</span> Start Review
                </button>
              ` : ''}
              <button class="deck-action-btn view" onclick="viewDeck('${deck.id}'); event.stopPropagation();">
                <span>📖</span> Browse
              </button>
              <button class="deck-action-btn add" onclick="addCard('${deck.id}'); event.stopPropagation();">
                <span>+</span> Add Card
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-text">No decks yet</div>
        <div class="empty-state-hint">
          Create your first deck using:<br>
          <code>Kioku: Create Deck</code><br>
          or import from markdown:<br>
          <code>Kioku: Import from Markdown</code>
        </div>
      </div>
    `}
  </div>

  ${deckStats.length > 0 ? `
    <div class="stats-section">
      <div class="stats-header">
        <h2 class="stats-title">📊 Your Progress</h2>
        <button class="stats-button" onclick="showStats()">View Details</button>
      </div>
      <div class="calendar-container">
        <div class="calendar-months">
          ${this.generateMonthLabels(recentStats)}
        </div>
        <div class="calendar-body">
          <div class="calendar-days">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div class="calendar">
            ${this.generateCalendar(recentStats)}
          </div>
        </div>
      </div>
      <div class="calendar-legend">
        <span>Less</span>
        <div class="legend-box" style="background: var(--vscode-input-background);"></div>
        <div class="legend-box" style="background: #0e4429;"></div>
        <div class="legend-box" style="background: #006d32;"></div>
        <div class="legend-box" style="background: #26a641;"></div>
        <div class="legend-box" style="background: #39d353;"></div>
        <span>More</span>
      </div>
      ${stats.streak_days > 0 ? `
        <div style="text-align: center; margin-top: 20px; font-size: 16px; color: var(--vscode-button-background);">
          🔥 <strong>${stats.streak_days} day streak!</strong>
        </div>
      ` : ''}
    </div>
  ` : ''}

  <div class="footer">
    <p>Made with 🧠 by <a href="https://github.com/Justhiro55/Kioku" target="_blank">Kioku</a> • Open Source on GitHub</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function startReview(deckId) {
      vscode.postMessage({
        command: 'startReview',
        deckId: deckId
      });
    }

    function showStats() {
      vscode.postMessage({
        command: 'showStats'
      });
    }

    function viewDeck(deckId) {
      vscode.postMessage({
        command: 'viewDeck',
        deckId: deckId
      });
    }

    function addCard(deckId) {
      vscode.postMessage({
        command: 'addCard',
        deckId: deckId
      });
    }

    function importDeck() {
      vscode.postMessage({
        command: 'importDeck'
      });
    }

    function toggleDeckMode(deckId, newMode) {
      vscode.postMessage({
        command: 'toggleDeckReviewMode',
        deckId: deckId,
        reviewMode: newMode
      });
    }

    function updateDailyLimit(newLimit) {
      // Minimum limit is 5
      if (newLimit < 5) {
        newLimit = 5;
      }
      vscode.postMessage({
        command: 'updateDailyLimit',
        dailyLimit: newLimit
      });
    }
  </script>
</body>
</html>`;
  }

  private generateMonthLabels(recentStats: { date: string; reviews: number }[]): string {
    const months: { month: string; weekIndex: number }[] = [];
    let lastMonth = '';

    // Group into weeks first
    const weeks: { date: string; reviews: number }[][] = [];
    let currentWeek: { date: string; reviews: number }[] = [];

    recentStats.forEach((stat, index) => {
      currentWeek.push(stat);
      if (currentWeek.length === 7 || index === recentStats.length - 1) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    // Find month boundaries
    weeks.forEach((week, weekIndex) => {
      const firstDay = new Date(week[0].date);
      const monthName = firstDay.toLocaleDateString('en-US', { month: 'short' });

      if (monthName !== lastMonth) {
        months.push({ month: monthName, weekIndex });
        lastMonth = monthName;
      }
    });

    return months.map(m =>
      `<div class="calendar-month" style="margin-left: ${m.weekIndex * 16}px;">${m.month}</div>`
    ).join('');
  }

  private generateCalendar(recentStats: { date: string; reviews: number }[]): string {
    // Group days into weeks
    const weeks: { date: string; reviews: number }[][] = [];
    let currentWeek: { date: string; reviews: number }[] = [];

    recentStats.forEach((stat, index) => {
      currentWeek.push(stat);

      if (currentWeek.length === 7 || index === recentStats.length - 1) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    // Find max reviews for level calculation
    const maxReviews = Math.max(...recentStats.map(s => s.reviews));

    return weeks.map(week => {
      const days = week.map(day => {
        const level = this.getReviewLevel(day.reviews, maxReviews);
        const date = new Date(day.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tooltip = `${dateStr}: ${day.reviews} reviews`;

        return `<div class="day" data-level="${level}" data-reviews="${day.reviews}" data-tooltip="${tooltip}"></div>`;
      }).join('');

      return `<div class="week">${days}</div>`;
    }).join('');
  }

  private getReviewLevel(reviews: number, maxReviews: number): number {
    if (reviews === 0) {return 0;}
    if (maxReviews === 0) {return 0;}

    const ratio = reviews / maxReviews;
    if (ratio >= 0.75) {return 4;}
    if (ratio >= 0.5) {return 3;}
    if (ratio >= 0.25) {return 2;}
    return 1;
  }

  private getDeckBrowserContent(deck: Deck, cards: Card[]): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browse ${this.escapeHtml(deck.name)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 30px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .title-section h1 {
      font-size: 32px;
      margin-bottom: 5px;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }

    .back-btn {
      padding: 10px 20px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .back-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .add-card-btn {
      padding: 10px 20px;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
    }

    .add-card-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
    }

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .card-item {
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 20px;
      transition: all 0.2s;
    }

    .card-item:hover {
      border-color: var(--vscode-button-background);
      transform: translateX(5px);
    }

    .card-content {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 20px;
      align-items: center;
    }

    .card-front {
      font-weight: bold;
      font-size: 16px;
    }

    .card-back {
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }

    .delete-btn {
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .delete-btn:hover {
      background: #c82333;
      transform: scale(1.05);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-section">
      <h1>📖 ${this.escapeHtml(deck.name)}</h1>
      <p class="subtitle">${cards.length} cards</p>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="add-card-btn" onclick="addNewCard('${deck.id}')">+ Add Card</button>
      <button class="back-btn" onclick="closeModal()">← Back to Home</button>
    </div>
  </div>

  ${cards.length > 0 ? `
    <div class="cards-list">
      ${cards.map(card => `
        <div class="card-item">
          <div class="card-content">
            <div class="card-front">${this.escapeHtml(card.front)}</div>
            <div class="card-back">${this.escapeHtml(card.back)}</div>
            <button class="delete-btn" onclick="deleteCard('${card.id}', '${deck.id}')">🗑️ Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  ` : `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>No cards in this deck yet</p>
    </div>
  `}

  <script>
    const vscode = acquireVsCodeApi();

    function closeModal() {
      vscode.postMessage({ command: 'closeModal' });
    }

    function addNewCard(deckId) {
      vscode.postMessage({
        command: 'addCard',
        deckId: deckId
      });
    }

    function deleteCard(cardId, deckId) {
      if (confirm('Delete this card?')) {
        vscode.postMessage({
          command: 'deleteCard',
          cardId: cardId,
          deckId: deckId
        });
      }
    }

    // Cmd+Delete or Ctrl+Backspace to go back to home
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        closeModal();
      }
    });
  </script>
</body>
</html>`;
  }

  private getAddCardContent(deck: Deck): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add Card to ${this.escapeHtml(deck.name)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 40px 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    .title-section h1 {
      font-size: 36px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 16px;
    }

    .form-container {
      max-width: 700px;
      margin: 0 auto;
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .card-preview {
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 16px;
      padding: 40px;
      margin-bottom: 30px;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      gap: 30px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .form-group {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .form-group.front {
      border-bottom: 2px dashed var(--vscode-input-border);
      padding-bottom: 30px;
    }

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
    }

    .label-icon {
      font-size: 18px;
    }

    textarea {
      width: 100%;
      min-height: 100px;
      padding: 0;
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      font-family: var(--vscode-font-family);
      font-size: 20px;
      resize: none;
      flex: 1;
    }

    textarea:focus {
      outline: none;
    }

    textarea::placeholder {
      color: var(--vscode-descriptionForeground);
      opacity: 0.5;
    }

    .form-hint {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      opacity: 0.7;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .save-btn {
      flex: 1;
      padding: 18px;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .save-btn:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
    }

    .save-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .cancel-btn {
      padding: 18px 32px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .cancel-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-2px);
    }

    .shortcut-hint {
      text-align: center;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-top: 16px;
      opacity: 0.7;
    }

    .shortcut-hint kbd {
      background: var(--vscode-input-background);
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
      font-family: monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-section">
      <h1>✨ Create New Card</h1>
      <p class="subtitle">${this.escapeHtml(deck.name)}</p>
    </div>
  </div>

  <div class="form-container">
    <div class="card-preview">
      <div class="form-group front">
        <label>
          <span class="label-icon">❓</span>
          Front (Question)
        </label>
        <textarea id="front" placeholder="What do you want to remember?"></textarea>
      </div>

      <div class="form-group">
        <label>
          <span class="label-icon">💡</span>
          Back (Answer)
        </label>
        <textarea id="back" placeholder="The answer or explanation..."></textarea>
      </div>
    </div>

    <div class="button-group">
      <button class="cancel-btn" onclick="closeModal()">Cancel</button>
      <button class="save-btn" onclick="saveCard()" id="saveBtn" disabled>
        <span>✓</span> Save Card
      </button>
    </div>

    <div class="shortcut-hint">
      Press <kbd>⌘</kbd> + <kbd>Enter</kbd> to save
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const frontInput = document.getElementById('front');
    const backInput = document.getElementById('back');
    const saveBtn = document.getElementById('saveBtn');

    function validateInputs() {
      const hasContent = frontInput.value.trim() && backInput.value.trim();
      saveBtn.disabled = !hasContent;
    }

    frontInput.addEventListener('input', validateInputs);
    backInput.addEventListener('input', validateInputs);

    // Auto-resize textareas
    function autoResize(textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }

    frontInput.addEventListener('input', () => autoResize(frontInput));
    backInput.addEventListener('input', () => autoResize(backInput));

    // Focus first input
    frontInput.focus();

    function closeModal() {
      vscode.postMessage({ command: 'closeModal' });
    }

    function saveCard() {
      const front = frontInput.value.trim();
      const back = backInput.value.trim();

      if (front && back) {
        vscode.postMessage({
          command: 'saveNewCard',
          deckId: '${deck.id}',
          front: front,
          back: back
        });
      }
    }

    // Submit on Ctrl/Cmd + Enter
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!saveBtn.disabled) {
          saveCard();
        }
      }
      // Cmd+Delete or Ctrl+Backspace to go back to home
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        closeModal();
      }
    });
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
