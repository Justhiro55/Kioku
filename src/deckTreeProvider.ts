import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { Deck, Card } from './types';

export class DeckTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private storage: StorageManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - show decks
      const decks = await this.storage.getDecks();
      return Promise.all(decks.map(async deck => {
        const cards = await this.storage.getCardsByDeck(deck.id);
        const dueCards = cards.filter(card => new Date(card.due_at) <= new Date());
        return new DeckTreeItem(deck, cards.length, dueCards.length);
      }));
    } else if (element instanceof DeckTreeItem) {
      // Show cards in deck
      const cards = await this.storage.getCardsByDeck(element.deck.id);
      return cards.map(card => new CardTreeItem(card));
    }
    return [];
  }
}

export class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

export class DeckTreeItem extends TreeItem {
  constructor(
    public readonly deck: Deck,
    public readonly totalCards: number,
    public readonly dueCards: number
  ) {
    super(
      `${deck.name} (${dueCards}/${totalCards})`,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    this.contextValue = 'deck';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.tooltip = `${deck.name}\nDue: ${dueCards} / Total: ${totalCards}`;
  }
}

export class CardTreeItem extends TreeItem {
  constructor(public readonly card: Card) {
    const isDue = new Date(card.due_at) <= new Date();
    const label = `${card.front.substring(0, 30)}${card.front.length > 30 ? '...' : ''}`;

    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'card';
    this.iconPath = new vscode.ThemeIcon(isDue ? 'circle-filled' : 'circle-outline');
    this.tooltip = `Front: ${card.front}\nBack: ${card.back}\nDue: ${new Date(card.due_at).toLocaleDateString()}`;
    this.description = isDue ? '📌 Due' : '';
  }
}
