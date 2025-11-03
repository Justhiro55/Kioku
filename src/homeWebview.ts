import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';

export class HomeWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private onStartReview: (deckId?: string) => void
  ) {}

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
    }
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

    this.panel.webview.html = this.getWebviewContent(deckStats, totalDue);
  }

  private getWebviewContent(deckStats: any[], totalDue: number): string {
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
      cursor: pointer;
      transition: all 0.3s;
      position: relative;
      overflow: hidden;
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
      opacity: 0.6;
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
    }

    .deck-due {
      font-weight: bold;
      color: var(--vscode-button-background);
    }

    .deck-done {
      color: #28a745;
      font-weight: bold;
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
          <div class="deck-card ${deck.dueCards === 0 ? 'no-due' : ''}" onclick="startReview('${deck.id}')">
            <div class="deck-icon">${deck.dueCards > 0 ? '📖' : '✅'}</div>
            <div class="deck-name">${this.escapeHtml(deck.name)}</div>
            <div class="deck-stats">
              <span>${deck.totalCards} cards</span>
              ${deck.dueCards > 0
                ? `<span class="deck-due">${deck.dueCards} due</span>`
                : `<span class="deck-done">All done!</span>`
              }
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

  <script>
    const vscode = acquireVsCodeApi();

    function startReview(deckId) {
      vscode.postMessage({
        command: 'startReview',
        deckId: deckId
      });
    }
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
