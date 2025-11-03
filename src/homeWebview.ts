import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';
import { StatisticsManager } from './statistics';
import { Card } from './types';
import { v4 as uuidv4 } from 'uuid';

export class HomeWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private statisticsManager: StatisticsManager;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private onStartReview: (deckId?: string) => void,
    private onShowStats?: () => void
  ) {
    this.statisticsManager = new StatisticsManager(context);
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

  private async handleMessage(message: any) {
    if (message.command === 'startReview') {
      this.onStartReview(message.deckId);
      if (this.panel) {
        this.panel.dispose();
      }
    } else if (message.command === 'showStats') {
      if (this.onShowStats) {
        this.onShowStats();
      }
    } else if (message.command === 'viewDeck') {
      await this.showDeckBrowser(message.deckId);
    } else if (message.command === 'addCard') {
      await this.showAddCard(message.deckId);
    } else if (message.command === 'closeModal') {
      await this.updateWebview();
    } else if (message.command === 'deleteCard') {
      await this.deleteCard(message.cardId);
      await this.showDeckBrowser(message.deckId);
    } else if (message.command === 'saveNewCard') {
      await this.saveNewCard(message.deckId, message.front, message.back);
      await this.showDeckBrowser(message.deckId);
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
    const newCard: Card = {
      id: uuidv4(),
      front,
      back,
      tags: [],
      deckId: deckId,
      created_at: new Date().toISOString(),
      due_at: new Date().toISOString(),
      interval: 0,
      reps: 0,
      ease: 2.5
    };

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
  }

  private async updateWebview() {
    if (!this.panel) {
      return;
    }

    const decks = await this.storage.getDecks();
    const allCards = await this.storage.getCards();

    // Calculate stats for each deck
    const deckStats = await Promise.all(decks.map(async (deck) => {
      const deckCards = await this.storage.getCardsByDeck(deck.id);
      const dueCards = SM2Algorithm.getDueCards(deckCards);
      return {
        id: deck.id,
        name: deck.name,
        totalCards: deckCards.length,
        dueCards: dueCards.length
      };
    }));

    // Calculate total due cards
    const totalDue = SM2Algorithm.getDueCards(allCards).length;

    // Get calendar data
    const recentStats = await this.statisticsManager.getRecentStats(90);
    const stats = await this.statisticsManager.getStatistics(allCards.length);

    this.panel.webview.html = this.getWebviewContent(deckStats, totalDue, recentStats, stats);
  }

  private getWebviewContent(deckStats: any[], totalDue: number, recentStats: any[], stats: any): string {
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

    .all-decks-button {
      width: 100%;
      max-width: 600px;
      margin: 0 auto 40px;
      padding: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 3px solid #764ba2;
      border-radius: 16px;
      cursor: pointer;
      display: block;
      transition: all 0.3s;
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
      position: relative;
      overflow: hidden;
    }

    .all-decks-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .all-decks-button:hover::before {
      left: 100%;
    }

    .all-decks-button:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 12px 40px rgba(102, 126, 234, 0.6);
      border-color: #667eea;
    }

    .all-decks-button:active {
      transform: translateY(-2px) scale(0.98);
    }

    .all-decks-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .all-decks-text {
      text-align: left;
    }

    .all-decks-title {
      font-size: 28px;
      font-weight: bold;
      color: white;
      margin-bottom: 8px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .all-decks-subtitle {
      font-size: 16px;
      color: white;
      opacity: 0.9;
    }

    .all-decks-badge {
      font-size: 48px;
      font-weight: bold;
      color: white;
      background: rgba(255, 255, 255, 0.2);
      padding: 10px 20px;
      border-radius: 12px;
      min-width: 80px;
      text-align: center;
      backdrop-filter: blur(10px);
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

    .deck-icon {
      font-size: 32px;
      margin-bottom: 10px;
    }

    .deck-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .deck-stats {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 15px;
    }

    .deck-due {
      font-weight: bold;
      color: var(--vscode-button-background);
    }

    .deck-done {
      color: #28a745;
      font-weight: bold;
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

  ${totalDue > 0 ? `
    <button class="all-decks-button" onclick="startReview(null)">
      <div class="all-decks-content">
        <div class="all-decks-text">
          <div class="all-decks-title">📚 Review All Decks</div>
          <div class="all-decks-subtitle">Start your learning session</div>
        </div>
        <div class="all-decks-badge">${totalDue}</div>
      </div>
    </button>
  ` : ''}

  <div class="decks-container">
    ${deckStats.length > 0 ? `
      <h2 class="section-title">Your Decks</h2>
      <div class="deck-grid">
        ${deckStats.map(deck => `
          <div class="deck-card ${deck.dueCards === 0 ? 'no-due' : ''}">
            <div class="deck-icon">${deck.dueCards > 0 ? '📖' : '✅'}</div>
            <div class="deck-name">${this.escapeHtml(deck.name)}</div>
            <div class="deck-stats">
              <span>${deck.totalCards} cards</span>
              ${deck.dueCards > 0
                ? `<span class="deck-due">${deck.dueCards} due</span>`
                : `<span class="deck-done">All done!</span>`
              }
            </div>
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

  private getDeckBrowserContent(deck: any, cards: any[]): string {
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
    <button class="back-btn" onclick="closeModal()">← Back to Home</button>
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

    function deleteCard(cardId, deckId) {
      if (confirm('Delete this card?')) {
        vscode.postMessage({
          command: 'deleteCard',
          cardId: cardId,
          deckId: deckId
        });
      }
    }
  </script>
</body>
</html>`;
  }

  private getAddCardContent(deck: any): string {
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

    .form-container {
      max-width: 600px;
      margin: 0 auto;
    }

    .form-group {
      margin-bottom: 25px;
    }

    label {
      display: block;
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 16px;
    }

    textarea {
      width: 100%;
      min-height: 120px;
      padding: 15px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 2px solid var(--vscode-input-border);
      border-radius: 6px;
      font-family: var(--vscode-font-family);
      font-size: 16px;
      resize: vertical;
    }

    textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .button-group {
      display: flex;
      gap: 10px;
    }

    .save-btn {
      flex: 1;
      padding: 15px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.2s;
    }

    .save-btn:hover {
      background: var(--vscode-button-hoverBackground);
      transform: translateY(-2px);
    }

    .save-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .cancel-btn {
      padding: 15px 30px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }

    .cancel-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-section">
      <h1>➕ Add New Card</h1>
      <p class="subtitle">to ${this.escapeHtml(deck.name)}</p>
    </div>
    <button class="back-btn" onclick="closeModal()">← Back to Home</button>
  </div>

  <div class="form-container">
    <div class="form-group">
      <label for="front">Front (Question)</label>
      <textarea id="front" placeholder="Enter the question or term..."></textarea>
    </div>

    <div class="form-group">
      <label for="back">Back (Answer)</label>
      <textarea id="back" placeholder="Enter the answer or definition..."></textarea>
    </div>

    <div class="button-group">
      <button class="save-btn" onclick="saveCard()" id="saveBtn" disabled>💾 Save Card</button>
      <button class="cancel-btn" onclick="closeModal()">Cancel</button>
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
