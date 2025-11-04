import * as vscode from 'vscode';
import * as fs from 'fs';
import { StorageManager } from './storage';
import { SM2Algorithm } from './sm2';

/**
 * JSON format for bulk import
 * Example:
 * [
 *   { "front": "apple", "back": "りんご", "tags": ["fruit"] },
 *   { "front": "banana", "back": "バナナ" }
 * ]
 */
interface JsonCard {
  front: string;
  back: string;
  tags?: string[];
}

/**
 * Import cards from JSON file
 */
export async function importFromJSON(storage: StorageManager): Promise<void> {
  const uri = await vscode.window.showOpenDialog({
    filters: { 'JSON Files': ['json'] },
    canSelectMany: false
  });

  if (!uri || uri.length === 0) {
    return;
  }

  try {
    const content = fs.readFileSync(uri[0].fsPath, 'utf8');
    const cards: JsonCard[] = JSON.parse(content);

    if (!Array.isArray(cards)) {
      vscode.window.showErrorMessage('JSON must be an array of cards');
      return;
    }

    // Validate cards
    const validCards = cards.filter(card => {
      if (!card.front || !card.back) {
        return false;
      }
      return true;
    });

    if (validCards.length === 0) {
      vscode.window.showWarningMessage('No valid cards found in JSON');
      return;
    }

    // Get target deck
    const defaultDeck = await storage.getDefaultDeck();

    // Import cards
    let importCount = 0;
    for (const card of validCards) {
      await storage.saveCard(SM2Algorithm.initializeCard({
        front: card.front,
        back: card.back,
        tags: card.tags || [],
        deckId: defaultDeck.id
      }));
      importCount++;
    }

    vscode.window.showInformationMessage(
      `Imported ${importCount} cards from JSON`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to import JSON: ${message}`);
  }
}

/**
 * Create cards from current JSON file
 */
export async function createFromJSONFile(storage: StorageManager): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  // Check if current file is JSON
  if (editor.document.languageId !== 'json') {
    vscode.window.showErrorMessage('Current file is not a JSON file');
    return;
  }

  try {
    const content = editor.document.getText();
    const cards: JsonCard[] = JSON.parse(content);

    if (!Array.isArray(cards)) {
      vscode.window.showErrorMessage('JSON must be an array of cards');
      return;
    }

    const validCards = cards.filter(card => card.front && card.back);

    if (validCards.length === 0) {
      vscode.window.showWarningMessage('No valid cards found');
      return;
    }

    // Confirm import
    const confirm = await vscode.window.showInformationMessage(
      `Import ${validCards.length} cards from current file?`,
      'Import',
      'Cancel'
    );

    if (confirm !== 'Import') {
      return;
    }

    const defaultDeck = await storage.getDefaultDeck();
    const now = new Date();

    for (const card of validCards) {
      await storage.saveCard(SM2Algorithm.initializeCard({
        front: card.front,
        back: card.back,
        tags: card.tags || [],
        deckId: defaultDeck.id
      }));
    }

    vscode.window.showInformationMessage(
      `Created ${validCards.length} cards`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to parse JSON: ${message}`);
  }
}

/**
 * Export cards to JSON format
 */
export async function exportToJSON(storage: StorageManager): Promise<void> {
  const cards = await storage.getCards();

  if (cards.length === 0) {
    vscode.window.showWarningMessage('No cards to export');
    return;
  }

  const jsonCards = cards.map(card => ({
    front: card.front,
    back: card.back,
    tags: card.tags
  }));

  const uri = await vscode.window.showSaveDialog({
    filters: { 'JSON Files': ['json'] },
    defaultUri: vscode.Uri.file(`kioku-cards-${Date.now()}.json`)
  });

  if (uri) {
    fs.writeFileSync(uri.fsPath, JSON.stringify(jsonCards, null, 2), 'utf8');
    vscode.window.showInformationMessage(`Exported ${cards.length} cards to JSON`);
  }
}
