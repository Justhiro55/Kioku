import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { MarkdownHandler } from './markdownHandler';
import { StorageManager } from './storage';
import { SQLiteStorage } from './sqliteStorage';
import { Deck } from './types';

export class GistHandler {
  /**
   * Import deck from URL (supports GitHub Gist, raw URLs, or any markdown URL)
   */
  static async importFromURL(storage: StorageManager | SQLiteStorage): Promise<{ deckName: string; cardsCount: number } | null> {
    const url = await vscode.window.showInputBox({
      prompt: 'Enter Gist URL or raw markdown URL',
      placeHolder: 'https://gist.github.com/username/...',
      validateInput: (value) => {
        if (!value) {
          return 'URL is required';
        }
        try {
          new URL(value);
          return null;
        } catch {
          return 'Invalid URL';
        }
      }
    });

    if (!url) {
      return null;
    }

    // Convert Gist URL to raw URL if needed
    const rawUrl = this.convertToRawUrl(url);

    try {
      // Fetch markdown content
      const content = await this.fetchContent(rawUrl);

      if (!content) {
        vscode.window.showErrorMessage('Failed to fetch content from URL');
        return null;
      }

      // Extract deck name or use default
      let deckName = MarkdownHandler.extractDeckName(content);
      if (!deckName) {
        deckName = 'Imported Deck';
      }

      // Ask user for deck name confirmation
      const userDeckName = await vscode.window.showInputBox({
        prompt: 'Enter deck name',
        value: deckName,
        placeHolder: 'My Deck'
      });

      if (!userDeckName) {
        return null;
      }

      // Create deck
      const deck = await storage.createDeck(userDeckName);

      // Parse and create cards
      const cards = MarkdownHandler.parseMarkdown(content, deck.id);

      for (const card of cards) {
        await storage.saveCard(card);
      }

      return {
        deckName: userDeckName,
        cardsCount: cards.length
      };
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import from URL: ${error}`);
      return null;
    }
  }

  /**
   * Convert GitHub Gist URL to raw URL
   */
  private static convertToRawUrl(url: string): string {
    // https://gist.github.com/username/gist_id -> https://gist.githubusercontent.com/username/gist_id/raw
    const gistMatch = url.match(/gist\.github\.com\/([^/]+)\/([a-f0-9]+)/);
    if (gistMatch) {
      return `https://gist.githubusercontent.com/${gistMatch[1]}/${gistMatch[2]}/raw`;
    }

    // Already a raw URL or other URL
    return url;
  }

  /**
   * Fetch content from URL
   */
  private static async fetchContent(url: string): Promise<string | null> {
    try {
      const client = url.startsWith('https') ? https : http;

      return new Promise((resolve, reject) => {
        client.get(url, (res: http.IncomingMessage) => {
          if (res.statusCode === 302 || res.statusCode === 301) {
            // Handle redirect
            this.fetchContent(res.headers.location ?? '').then(resolve).catch(reject);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });

          res.on('end', () => {
            resolve(data);
          });
        }).on('error', (err: Error) => {
          reject(err);
        });
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Share deck to clipboard as markdown (user can manually create Gist)
   */
  static async shareDeckAsMarkdown(storage: StorageManager | SQLiteStorage, deckId?: string): Promise<void> {
    let selectedDeckId = deckId;

    if (!selectedDeckId) {
      // Show deck picker
      const decks = await storage.getDecks();

      if (decks.length === 0) {
        vscode.window.showErrorMessage('No decks found.');
        return;
      }

      interface DeckQuickPickItem extends vscode.QuickPickItem {
        deckId: string;
      }

      const deckItems: DeckQuickPickItem[] = decks.map((d: Deck) => ({
        label: d.name,
        description: `${d.card_ids.length} cards`,
        deckId: d.id
      }));

      const selected = await vscode.window.showQuickPick(deckItems, {
        placeHolder: 'Select deck to share'
      });

      if (!selected) {
        return;
      }

      selectedDeckId = selected.deckId;
    }

    const deck = (await storage.getDecks()).find((d: Deck) => d.id === selectedDeckId);
    if (!deck) {
      vscode.window.showErrorMessage('Deck not found.');
      return;
    }

    const cards = await storage.getCardsByDeck(selectedDeckId);

    if (cards.length === 0) {
      vscode.window.showErrorMessage('No cards in this deck.');
      return;
    }

    // Generate markdown content
    let markdown = `# ${deck.name}\n\n`;

    for (const card of cards) {
      markdown += `## ${card.front}\n`;
      markdown += `${card.back}\n`;
      if (card.tags.length > 0) {
        markdown += `- Tags: ${card.tags.join(', ')}\n`;
      }
      markdown += '\n';
    }

    // Copy to clipboard
    await vscode.env.clipboard.writeText(markdown);

    const action = await vscode.window.showInformationMessage(
      `Deck "${deck.name}" copied to clipboard! Create a new Gist at github.com/gist and paste the content.`,
      'Open GitHub Gist'
    );

    if (action === 'Open GitHub Gist') {
      vscode.env.openExternal(vscode.Uri.parse('https://gist.github.com/'));
    }
  }
}
