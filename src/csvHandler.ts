import * as vscode from 'vscode';
import * as fs from 'fs';
import { Card } from './types';
import { StorageManager } from './storage';

/**
 * Export cards to CSV format
 * Format: front,back,tags,due_at,interval,reps,ease
 */
export async function exportCardsToCSV(
  storage: StorageManager,
  deckId?: string
): Promise<void> {
  const cards = deckId
    ? await storage.getCardsByDeck(deckId)
    : await storage.getCards();

  if (cards.length === 0) {
    vscode.window.showWarningMessage('No cards to export');
    return;
  }

  const csvContent = cardsToCSV(cards);

  const uri = await vscode.window.showSaveDialog({
    filters: { 'CSV Files': ['csv'] },
    defaultUri: vscode.Uri.file(`kioku-export-${Date.now()}.csv`)
  });

  if (uri) {
    fs.writeFileSync(uri.fsPath, csvContent, 'utf8');
    vscode.window.showInformationMessage(`Exported ${cards.length} cards to CSV`);
  }
}

/**
 * Import cards from CSV format
 */
export async function importCardsFromCSV(
  storage: StorageManager,
  targetDeckId?: string
): Promise<void> {
  const uri = await vscode.window.showOpenDialog({
    filters: { 'CSV Files': ['csv'] },
    canSelectMany: false
  });

  if (!uri || uri.length === 0) {
    return;
  }

  const csvContent = fs.readFileSync(uri[0].fsPath, 'utf8');
  const cards = parseCSVToCards(csvContent, targetDeckId);

  if (cards.length === 0) {
    vscode.window.showWarningMessage('No valid cards found in CSV');
    return;
  }

  // Determine target deck
  let deckId = targetDeckId;
  if (!deckId) {
    const defaultDeck = await storage.getDefaultDeck();
    deckId = defaultDeck.id;
  }

  // Import cards
  for (const cardData of cards) {
    await storage.saveCard({
      ...cardData,
      deckId: deckId
    });
  }

  vscode.window.showInformationMessage(`Imported ${cards.length} cards`);
}

/**
 * Convert cards to CSV format
 */
function cardsToCSV(cards: Card[]): string {
  const header = 'front,back,tags,due_at,interval,reps,ease\n';
  const rows = cards.map(card => {
    return [
      escapeCsvField(card.front),
      escapeCsvField(card.back),
      escapeCsvField(card.tags.join('|')),
      card.due_at,
      card.interval,
      card.reps,
      card.ease
    ].join(',');
  });

  return header + rows.join('\n');
}

/**
 * Parse CSV content to cards
 */
function parseCSVToCards(
  csvContent: string,
  deckId?: string
): Omit<Card, 'id' | 'created_at'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return [];
  }

  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('front') ? 1 : 0;
  const cards: Omit<Card, 'id' | 'created_at'>[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);

    if (fields.length < 2) {
      continue; // Skip invalid lines
    }

    const card: Omit<Card, 'id' | 'created_at'> = {
      front: fields[0] || '',
      back: fields[1] || '',
      tags: fields[2] ? fields[2].split('|').filter(t => t) : [],
      due_at: fields[3] || new Date().toISOString(),
      interval: parseFloat(fields[4]) || 0,
      reps: parseInt(fields[5]) || 0,
      ease: parseFloat(fields[6]) || 2.5,
      deckId: deckId || ''
    };

    if (card.front && card.back) {
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Escape CSV field (handle quotes and commas)
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Parse a single CSV line (handle quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
