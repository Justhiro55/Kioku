import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Card, Deck } from './types';
import { StorageManager } from './storage';
import { SQLiteStorage } from './sqliteStorage';

export class MarkdownHandler {
  /**
   * Parse markdown content into flashcards
   * Format:
   * # Deck Name (optional, uses H1 as deck name)
   *
   * ## Card Front (H2 = card front)
   * Card back content (paragraph after H2)
   * - Tags: tag1, tag2
   *
   * ```language
   * code example (optional)
   * ```
   */
  static parseMarkdown(content: string, deckId: string): Card[] {
    const lines = content.split('\n');
    const cards: Card[] = [];

    let currentFront = '';
    let currentBack = '';
    let currentTags: string[] = [];
    let currentExamples: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block handling
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (codeBlockContent.trim()) {
            currentExamples.push(codeBlockContent.trim());
          }
          codeBlockContent = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
      }

      // H2 = New card front
      if (line.startsWith('## ')) {
        // Save previous card if exists
        if (currentFront && currentBack) {
          cards.push(this.createCard(
            currentFront,
            currentBack,
            currentTags,
            currentExamples,
            deckId
          ));
        }

        // Start new card
        currentFront = line.substring(3).trim();
        currentBack = '';
        currentTags = [];
        currentExamples = [];
        continue;
      }

      // Skip H1 (deck name)
      if (line.startsWith('# ')) {
        continue;
      }

      // Tags line
      if (line.trim().startsWith('- Tags:') || line.trim().startsWith('- tags:')) {
        const tagsStr = line.substring(line.indexOf(':') + 1).trim();
        currentTags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        continue;
      }

      // Regular content = back of card
      if (currentFront && line.trim() && !line.startsWith('#')) {
        if (currentBack) {
          currentBack += '\n' + line.trim();
        } else {
          currentBack = line.trim();
        }
      }
    }

    // Save last card
    if (currentFront && currentBack) {
      cards.push(this.createCard(
        currentFront,
        currentBack,
        currentTags,
        currentExamples,
        deckId
      ));
    }

    return cards;
  }

  private static createCard(
    front: string,
    back: string,
    tags: string[],
    examples: string[],
    deckId: string
  ): Card {
    // Add examples to back if they exist
    let fullBack = back;
    if (examples.length > 0) {
      fullBack += '\n\n' + examples.join('\n\n');
    }

    return {
      id: uuidv4(),
      front,
      back: fullBack,
      tags,
      created_at: new Date().toISOString(),
      due_at: new Date().toISOString(),
      interval: 0,
      reps: 0,
      ease: 2.5,
      deckId
    };
  }

  /**
   * Extract deck name from markdown (first H1 heading)
   */
  static extractDeckName(content: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.substring(2).trim();
      }
    }
    return null;
  }

  /**
   * Import cards from markdown file
   */
  static async importFromMarkdown(
    storage: StorageManager | SQLiteStorage,
    filePath?: string
  ): Promise<{ deckName: string; cardsCount: number } | null> {
    let content: string;
    let fileName: string;

    if (filePath) {
      // Import from specific file path
      const uri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(uri);
      content = Buffer.from(fileContent).toString('utf8');
      fileName = filePath.split('/').pop() || 'deck';
    } else {
      // Show file picker
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'Markdown': ['md', 'markdown']
        },
        openLabel: 'Import Markdown Deck'
      });

      if (!fileUri || fileUri.length === 0) {
        return null;
      }

      const fileContent = await vscode.workspace.fs.readFile(fileUri[0]);
      content = Buffer.from(fileContent).toString('utf8');
      fileName = fileUri[0].path.split('/').pop() || 'deck';
    }

    // Extract deck name or use filename
    let deckName = this.extractDeckName(content);
    if (!deckName) {
      deckName = fileName.replace(/\.md$/, '');
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
    const cards = this.parseMarkdown(content, deck.id);

    for (const card of cards) {
      await storage.saveCard(card);
    }

    return {
      deckName: userDeckName,
      cardsCount: cards.length
    };
  }

  /**
   * Create cards from currently open markdown file
   */
  static async createFromCurrentMarkdownFile(storage: StorageManager | SQLiteStorage): Promise<{ deckName: string; cardsCount: number } | null> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showErrorMessage('No active editor. Please open a markdown file.');
      return null;
    }

    const document = editor.document;

    if (document.languageId !== 'markdown') {
      vscode.window.showErrorMessage('Current file is not a markdown file.');
      return null;
    }

    const content = document.getText();

    // Extract deck name or use filename
    let deckName = this.extractDeckName(content);
    if (!deckName) {
      const fileName = document.fileName.split('/').pop() || 'deck';
      deckName = fileName.replace(/\.md$/, '');
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
    const cards = this.parseMarkdown(content, deck.id);

    for (const card of cards) {
      await storage.saveCard(card);
    }

    return {
      deckName: userDeckName,
      cardsCount: cards.length
    };
  }

  /**
   * Export deck to markdown format
   */
  static async exportToMarkdown(storage: StorageManager | SQLiteStorage, deckId?: string): Promise<void> {
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
        placeHolder: 'Select deck to export'
      });

      if (!selected) {
        return;
      }

      selectedDeckId = selected.deckId;
    }

    const deck = (await storage.getDecks()).find((d: Deck) => d.id === selectedDeckId);
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

    // Show save dialog
    const fileUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${deck.name}.md`),
      filters: {
        'Markdown': ['md']
      }
    });

    if (!fileUri) {
      return;
    }

    // Write file
    await vscode.workspace.fs.writeFile(
      fileUri,
      Buffer.from(markdown, 'utf8')
    );

    vscode.window.showInformationMessage(
      `Exported ${cards.length} cards to ${fileUri.path}`
    );
  }
}
