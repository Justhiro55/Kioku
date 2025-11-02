import * as vscode from 'vscode';
import { Card } from './types';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';

export class ReviewWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private cards: Card[] = [];
  private currentIndex: number = 0;
  private showingAnswer: boolean = false;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private onComplete: () => void
  ) {}

  async show() {
    const allCards = await this.storage.getCards();
    this.cards = SM2Algorithm.getDueCards(allCards);

    if (this.cards.length === 0) {
      vscode.window.showInformationMessage('No cards due for review! 🎉');
      return;
    }

    this.currentIndex = 0;
    this.showingAnswer = false;

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
    }
  }

  private async rateCard(quality: number) {
    const card = this.cards[this.currentIndex];
    const updatedCard = SM2Algorithm.calculateNextReview(card, quality);
    await this.storage.updateCard(updatedCard);

    this.nextCard();
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

  private complete() {
    if (this.panel) {
      this.panel.dispose();
    }
    vscode.window.showInformationMessage(
      `Review completed! Reviewed ${this.cards.length} cards 🎉`
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
    const config = vscode.workspace.getConfiguration('kioku');
    const spellMode = config.get<boolean>('spellMode', true);

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

    .rating-buttons button {
      padding: 16px;
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

      ${!showingAnswer && spellMode ? `
        <div class="input-container">
          <input
            type="text"
            id="answer-input"
            placeholder="Type your answer..."
            autofocus
          />
          <div class="hint">Press Enter to check</div>
        </div>
      ` : ''}

      ${showingAnswer ? `
        <div class="answer">${this.escapeHtml(card.back)}</div>
      ` : ''}
    </div>

    ${!showingAnswer ? `
      <div class="buttons">
        <button class="secondary" onclick="skip()">Skip</button>
        <button onclick="showAnswer()">
          ${spellMode ? 'Check Answer' : 'Show Answer'}
        </button>
      </div>
    ` : `
      <div class="rating-buttons">
        <button class="rating-0" onclick="rate(0)">0 - Forgot ❌</button>
        <button class="rating-1" onclick="rate(1)">1 - Again 🔄</button>
        <button class="rating-2" onclick="rate(2)">2 - Hard 😓</button>
        <button class="rating-3" onclick="rate(3)">3 - OK 👍</button>
        <button class="rating-4" onclick="rate(4)">4 - Good ✅</button>
        <button class="rating-5" onclick="rate(5)">5 - Perfect ✨</button>
      </div>
    `}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    ${spellMode ? `
      const input = document.getElementById('answer-input');
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            showAnswer();
          }
        });
      }
    ` : ''}

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
