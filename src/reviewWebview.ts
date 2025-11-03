import * as vscode from 'vscode';
import { Card } from './types';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';
import { StatisticsManager } from './statistics';

interface ReviewMessage {
  command: string;
  quality?: number;
}

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
    private deckId?: string,
    private onBackToHome?: () => void
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

  private async handleMessage(message: ReviewMessage) {
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

      case 'close':
        if (this.panel) {
          this.panel.dispose();
        }
        this.onComplete();
        break;

      case 'backToHome':
        if (this.panel) {
          this.panel.dispose();
        }
        if (this.onBackToHome) {
          this.onBackToHome();
        } else {
          this.onComplete();
        }
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

    // Show completion screen instead of closing
    const accuracy = Math.round((this.correctCount / this.cards.length) * 100);
    this.showCompletionScreen(this.cards.length, this.correctCount, accuracy, durationSeconds);
  }

  private showCompletionScreen(totalCards: number, correctCards: number, accuracy: number, durationSeconds: number) {
    if (!this.panel) {
      return;
    }

    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    this.panel.webview.html = this.getCompletionContent(totalCards, correctCards, accuracy, timeString);
  }

  private getCompletionContent(totalCards: number, correctCards: number, accuracy: number, timeString: string): string {
    let emoji = '🎉';
    let title = 'Great Job!';
    let message = 'Keep up the good work!';

    if (accuracy === 100) {
      emoji = '🌟';
      title = 'Perfect!';
      message = 'You got every card right!';
    } else if (accuracy >= 80) {
      emoji = '🎉';
      title = 'Excellent!';
      message = 'Outstanding performance!';
    } else if (accuracy >= 60) {
      emoji = '👍';
      title = 'Good Work!';
      message = 'You\'re making progress!';
    } else {
      emoji = '💪';
      title = 'Keep Practicing!';
      message = 'Every review makes you stronger!';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Complete</title>
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
      align-items: center;
      justify-content: center;
    }

    .completion-container {
      max-width: 600px;
      width: 100%;
      text-align: center;
    }

    .emoji {
      font-size: 96px;
      margin-bottom: 20px;
      animation: bounce 0.6s ease;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }

    h1 {
      font-size: 48px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .message {
      font-size: 20px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 40px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 12px;
      padding: 24px;
      transition: all 0.3s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: #667eea;
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .accuracy-circle {
      width: 150px;
      height: 150px;
      margin: 0 auto 40px;
      position: relative;
    }

    .circle-bg {
      fill: none;
      stroke: var(--vscode-input-border);
      stroke-width: 12;
    }

    .circle-progress {
      fill: none;
      stroke: url(#gradient);
      stroke-width: 12;
      stroke-linecap: round;
      transform: rotate(-90deg);
      transform-origin: 50% 50%;
      stroke-dasharray: ${2 * Math.PI * 60};
      stroke-dashoffset: ${2 * Math.PI * 60 * (1 - accuracy / 100)};
      animation: fillCircle 1s ease-out;
    }

    @keyframes fillCircle {
      from {
        stroke-dashoffset: ${2 * Math.PI * 60};
      }
    }

    .circle-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      font-weight: 700;
    }

    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    button {
      padding: 18px 32px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .primary-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .primary-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    .secondary-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .secondary-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="completion-container">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p class="message">${message}</p>

    <div class="accuracy-circle">
      <svg width="150" height="150">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle class="circle-bg" cx="75" cy="75" r="60"></circle>
        <circle class="circle-progress" cx="75" cy="75" r="60"></circle>
      </svg>
      <div class="circle-text">${accuracy}%</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalCards}</div>
        <div class="stat-label">Cards</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${correctCards}</div>
        <div class="stat-label">Correct</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${timeString}</div>
        <div class="stat-label">Time</div>
      </div>
    </div>

    <div class="buttons">
      <button class="secondary-btn" onclick="close()">Close</button>
      <button class="primary-btn" onclick="backToHome()">Back to Home</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function close() {
      vscode.postMessage({ command: 'close' });
    }

    function backToHome() {
      vscode.postMessage({ command: 'backToHome' });
    }
  </script>
</body>
</html>`;
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
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .progress {
      text-align: center;
      font-size: 15px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .progress-number {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 18px;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: var(--vscode-input-background);
      border-radius: 10px;
      margin-bottom: 40px;
      overflow: hidden;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      width: ${(progress / total) * 100}%;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
    }

    .card-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 700px;
      margin: 0 auto;
      width: 100%;
    }

    .card {
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border);
      border-radius: 16px;
      padding: 50px;
      text-align: center;
      width: 100%;
      min-height: 300px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 30px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .front {
      font-size: 36px;
      font-weight: 600;
      margin-bottom: 20px;
      line-height: 1.4;
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
      font-size: 28px;
      color: var(--vscode-textLink-foreground);
      margin-top: 30px;
      padding-top: 30px;
      border-top: 2px dashed var(--vscode-input-border);
      line-height: 1.5;
    }

    .buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    button {
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    button:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }

    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      box-shadow: none;
    }

    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .rating-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      width: 100%;
      max-width: 700px;
      margin-top: 20px;
    }

    .rating-buttons button {
      padding: 20px 16px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      transition: all 0.2s;
    }

    .rating-buttons button:hover {
      transform: translateY(-4px) scale(1.05);
    }

    .rating-label {
      font-size: 16px;
      font-weight: 700;
    }

    .rating-time {
      font-size: 12px;
      opacity: 0.9;
    }

    .rating-1 {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
    }
    .rating-1:hover { box-shadow: 0 6px 20px rgba(220, 53, 69, 0.5); }

    .rating-2 {
      background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
      color: #000;
      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
    }
    .rating-2:hover { box-shadow: 0 6px 20px rgba(255, 193, 7, 0.5); }

    .rating-3 {
      background: linear-gradient(135deg, #28a745 0%, #218838 100%);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    }
    .rating-3:hover { box-shadow: 0 6px 20px rgba(40, 167, 69, 0.5); }

    .rating-4 {
      background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
      box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
    }
    .rating-4:hover { box-shadow: 0 6px 20px rgba(23, 162, 184, 0.5); }

    .hint {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="progress">
    <span>Card</span>
    <span class="progress-number">${progress}</span>
    <span>of</span>
    <span class="progress-number">${total}</span>
  </div>
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
      <div class="rating-buttons">
        <button class="rating-1" onclick="rate(1)">
          <div class="rating-label">Again</div>
          <div class="rating-time">&lt;1 min</div>
        </button>
        <button class="rating-2" onclick="rate(2)">
          <div class="rating-label">Hard</div>
          <div class="rating-time">&lt;10 min</div>
        </button>
        <button class="rating-3" onclick="rate(3)">
          <div class="rating-label">Good</div>
          <div class="rating-time">1 day</div>
        </button>
        <button class="rating-4" onclick="rate(4)">
          <div class="rating-label">Easy</div>
          <div class="rating-time">4 days</div>
        </button>
      </div>
      <div style="text-align: center; margin-top: 16px; font-size: 13px; color: var(--vscode-descriptionForeground); opacity: 0.8;">
        <kbd style="background: var(--vscode-input-background); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border); font-family: monospace; font-size: 11px;">1</kbd>
        <kbd style="background: var(--vscode-input-background); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border); font-family: monospace; font-size: 11px;">2</kbd>
        <kbd style="background: var(--vscode-input-background); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border); font-family: monospace; font-size: 11px;">3</kbd>
        <kbd style="background: var(--vscode-input-background); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border); font-family: monospace; font-size: 11px;">4</kbd>
        or <kbd style="background: var(--vscode-input-background); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--vscode-input-border); font-family: monospace; font-size: 11px;">⌘Z</kbd> to undo
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
