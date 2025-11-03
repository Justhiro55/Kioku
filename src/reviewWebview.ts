import * as vscode from 'vscode';
import { Card } from './types';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';
import { StatisticsManager } from './statistics';

export class ReviewWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private cards: Card[] = [];
  private currentIndex: number = 0;
  private showingAnswer: boolean = false;
  private correctCount: number = 0;
  private startTime: number = 0;
  private statisticsManager: StatisticsManager;
  private reviewHistory: Array<{ cardIndex: number; originalCard: Card }> = [];

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private onComplete: () => void,
    private deckId?: string
  ) {
    this.statisticsManager = new StatisticsManager(context);
  }

  async show() {
    let allCards = await this.storage.getCards();

    // Filter by deck if specified
    if (this.deckId) {
      allCards = await this.storage.getCardsByDeck(this.deckId);
    }

    this.cards = SM2Algorithm.getDueCards(allCards);

    if (this.cards.length === 0) {
      vscode.window.showInformationMessage('No cards due for review! 🎉');
      return;
    }

    this.currentIndex = 0;
    this.showingAnswer = false;
    this.correctCount = 0;
    this.startTime = Date.now();

    this.panel = vscode.window.createWebviewPanel(
      'kiokuReview',
      'Kioku Review',
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

    this.updateWebview();
  }

  private async handleMessage(message: any) {
    switch (message.command) {
      case 'showAnswer':
        this.showingAnswer = true;
        this.updateWebview();
        break;

      case 'rate':
        await this.rateCard(message.quality);
        break;

      case 'skip':
        this.nextCard();
        break;

      case 'undo':
        await this.undoLastReview();
        break;
    }
  }

  private async rateCard(quality: number) {
    const card = this.cards[this.currentIndex];

    // Save original state for undo
    this.reviewHistory.push({
      cardIndex: this.currentIndex,
      originalCard: JSON.parse(JSON.stringify(card))
    });

    const updatedCard = SM2Algorithm.calculateNextReview(card, quality);
    await this.storage.updateCard(updatedCard);

    // Update local cards array
    this.cards[this.currentIndex] = updatedCard;

    // Track correct answers (quality >= 3)
    if (quality >= 3) {
      this.correctCount++;
    }

    this.nextCard();
  }

  private async undoLastReview() {
    if (this.reviewHistory.length === 0) {
      return; // Nothing to undo
    }

    const lastReview = this.reviewHistory.pop()!;

    // Restore original card state
    await this.storage.updateCard(lastReview.originalCard);
    this.cards[lastReview.cardIndex] = lastReview.originalCard;

    // Go back to that card
    this.currentIndex = lastReview.cardIndex;
    this.showingAnswer = false;

    // Adjust correct count
    if (this.correctCount > 0) {
      this.correctCount--;
    }

    this.updateWebview();
  }

  private nextCard() {
    this.currentIndex++;
    this.showingAnswer = false;

    if (this.currentIndex >= this.cards.length) {
      this.complete();
    } else {
      this.updateWebview();
    }
  }

  private async complete() {
    // Record review session
    const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const today = new Date().toISOString().split('T')[0];

    await this.statisticsManager.recordSession({
      date: today,
      cards_reviewed: this.cards.length,
      cards_correct: this.correctCount,
      duration_seconds: durationSeconds
    });

    if (this.panel) {
      this.panel.dispose();
    }

    const accuracy = Math.round((this.correctCount / this.cards.length) * 100);
    vscode.window.showInformationMessage(
      `Review completed! ${this.cards.length} cards, ${accuracy}% accuracy 🎉`
    );
    this.onComplete();
  }

  private updateWebview() {
    if (!this.panel) {
      return;
    }

    const card = this.cards[this.currentIndex];
    const progress = this.currentIndex + 1;
    const total = this.cards.length;

    this.panel.webview.html = this.getWebviewContent(
      card,
      this.showingAnswer,
      progress,
      total
    );
  }

  private getWebviewContent(
    card: Card,
    showingAnswer: boolean,
    progress: number,
    total: number
  ): string {

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kioku Review</title>
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
      padding: 20px;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .progress {
      text-align: center;
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--vscode-input-background);
      border-radius: 2px;
      margin-bottom: 30px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--vscode-button-background);
      width: ${(progress / total) * 100}%;
      transition: width 0.3s ease;
    }

    .card-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 600px;
      margin: 0 auto;
      width: 100%;
    }

    .card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      width: 100%;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 30px;
    }

    .front {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 20px;
    }

    .input-container {
      width: 100%;
      margin-top: 20px;
    }

    input {
      width: 100%;
      padding: 12px;
      font-size: 18px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      outline: none;
    }

    input:focus {
      border-color: var(--vscode-focusBorder);
    }

    .answer {
      font-size: 24px;
      color: var(--vscode-textLink-foreground);
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-input-border);
    }

    .buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    button {
      padding: 12px 24px;
      font-size: 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      transition: all 0.2s;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
      transform: translateY(-2px);
    }

    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .rating-buttons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 500px;
      margin-top: 20px;
    }

    .rating-buttons.simple {
      grid-template-columns: repeat(2, 1fr);
      max-width: 400px;
    }

    .rating-buttons.anki {
      grid-template-columns: repeat(4, 1fr);
      max-width: 600px;
    }

    .rating-buttons button {
      padding: 16px;
      font-size: 14px;
    }

    .rating-buttons.simple button {
      padding: 20px;
      font-size: 16px;
    }

    .rating-buttons.anki button {
      padding: 18px 12px;
      font-size: 14px;
    }

    .rating-0 { background: #dc3545; }
    .rating-1 { background: #fd7e14; }
    .rating-2 { background: #ffc107; color: #000; }
    .rating-3 { background: #28a745; }
    .rating-4 { background: #20c997; }
    .rating-5 { background: #17a2b8; }

    .hint {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="progress">Card ${progress} of ${total}</div>
  <div class="progress-bar">
    <div class="progress-fill"></div>
  </div>

  <div class="card-container">
    <div class="card">
      <div class="front">${this.escapeHtml(card.front)}</div>

      ${showingAnswer ? `
        <div class="answer">${this.escapeHtml(card.back)}</div>
      ` : ''}
    </div>

    ${!showingAnswer ? `
      <div class="buttons">
        <button onclick="showAnswer()">
          Show Answer
        </button>
      </div>
    ` : `
      <div class="rating-buttons anki">
        <button class="rating-1" onclick="rate(1)">
          <div>Again</div>
          <div style="font-size: 12px; margin-top: 5px;">&lt;1 min</div>
        </button>
        <button class="rating-2" onclick="rate(2)">
          <div>Hard</div>
          <div style="font-size: 12px; margin-top: 5px;">&lt;10 min</div>
        </button>
        <button class="rating-3" onclick="rate(3)">
          <div>Good</div>
          <div style="font-size: 12px; margin-top: 5px;">1 day</div>
        </button>
        <button class="rating-4" onclick="rate(4)">
          <div>Easy</div>
          <div style="font-size: 12px; margin-top: 5px;">4 days</div>
        </button>
      </div>
      <div style="text-align: center; margin-top: 10px; font-size: 12px; color: var(--vscode-descriptionForeground);">
        Keyboard: 1 (Again) | 2 (Hard) | 3 (Good) | 4 (Easy)
      </div>
    `}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const showingAnswer = ${showingAnswer};

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Undo shortcut (Cmd+Z on Mac, Ctrl+Z on Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        vscode.postMessage({ command: 'undo' });
        return;
      }

      if (!showingAnswer) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          showAnswer();
        }
      } else {
        // Anki mode shortcuts (1-4)
        if (e.key === '1') rate(1); // Again
        if (e.key === '2') rate(2); // Hard
        if (e.key === '3') rate(3); // Good
        if (e.key === '4') rate(4); // Easy
      }
    });

    function showAnswer() {
      vscode.postMessage({ command: 'showAnswer' });
    }

    function rate(quality) {
      vscode.postMessage({ command: 'rate', quality });
    }

    function skip() {
      vscode.postMessage({ command: 'skip' });
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
