import * as vscode from 'vscode';
import { StatisticsManager } from './statistics';
import { StorageManager } from './storage';

export class StatsWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private statsManager: StatisticsManager
  ) {}

  async show() {
    this.panel = vscode.window.createWebviewPanel(
      'kiokuStats',
      'Kioku Statistics',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = await this.getWebviewContent();
  }

  private async getWebviewContent(): Promise<string> {
    const allCards = await this.storage.getCards();
    const stats = await this.statsManager.getStatistics(allCards.length);
    const recentStats = await this.statsManager.getRecentStats(90);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kioku Statistics</title>
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
    }

    h1 {
      font-size: 24px;
      margin-bottom: 30px;
      border-bottom: 2px solid var(--vscode-button-background);
      padding-bottom: 10px;
    }

    h2 {
      font-size: 18px;
      margin: 30px 0 15px 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: var(--vscode-button-background);
      margin-bottom: 10px;
    }

    .stat-label {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    .calendar {
      display: grid;
      grid-template-columns: repeat(13, 1fr);
      gap: 3px;
      max-width: 800px;
    }

    .week {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .day {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      position: relative;
      cursor: pointer;
    }

    .day[data-reviews="0"] {
      background: var(--vscode-input-background);
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
      font-size: 12px;
      z-index: 10;
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
      font-size: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .streak-badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 18px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>📊 Learning Statistics</h1>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${stats.total_cards}</div>
      <div class="stat-label">Total Cards</div>
    </div>

    <div class="stat-card">
      <div class="stat-value">${stats.total_reviews}</div>
      <div class="stat-label">Total Reviews</div>
    </div>

    <div class="stat-card">
      <div class="stat-value">${stats.total_review_sessions}</div>
      <div class="stat-label">Review Sessions</div>
    </div>

    <div class="stat-card">
      <div class="stat-value">${stats.accuracy_rate}%</div>
      <div class="stat-label">Accuracy Rate</div>
    </div>
  </div>

  ${stats.streak_days > 0 ? `
    <div class="streak-badge">
      🔥 ${stats.streak_days} Day Streak!
    </div>
  ` : ''}

  <h2>📅 Review Calendar (Last 90 Days)</h2>
  <div class="calendar">
    ${this.generateCalendar(recentStats)}
  </div>

  <div class="legend">
    <span>Less</span>
    <div class="legend-item">
      <div class="legend-box" style="background: var(--vscode-input-background);"></div>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: #0e4429;"></div>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: #006d32;"></div>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: #26a641;"></div>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: #39d353;"></div>
    </div>
    <span>More</span>
  </div>
</body>
</html>`;
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
        const dateStr = date.toLocaleDateString();

        return `<div class="day"
                     data-reviews="${day.reviews}"
                     data-level="${level}"
                     data-tooltip="${dateStr}: ${day.reviews} reviews"></div>`;
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
}
