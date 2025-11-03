import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { Card, Deck } from './types';
import { v4 as uuidv4 } from 'uuid';

interface CardRow {
  id: string;
  front: string;
  back: string;
  tags: string;
  created_at: string;
  due_at: string;
  interval: number;
  reps: number;
  ease: number;
  deck_id: string;
  image?: string;
}

interface DeckRow {
  id: string;
  name: string;
  created_at: string;
}

/**
 * SQLite storage implementation
 */
export class SQLiteStorage {
  private db: Database.Database;
  private static readonly DEFAULT_DECK_ID = 'default';

  constructor(private context: vscode.ExtensionContext) {
    const dbPath = path.join(context.globalStorageUri.fsPath, 'kioku.db');

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        tags TEXT NOT NULL,
        due_at TEXT NOT NULL,
        interval INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        ease REAL NOT NULL,
        deck_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
      CREATE INDEX IF NOT EXISTS idx_cards_due_at ON cards(due_at);
    `);

    // Create default deck if not exists
    const defaultDeck = this.db.prepare('SELECT * FROM decks WHERE id = ?').get(SQLiteStorage.DEFAULT_DECK_ID);
    if (!defaultDeck) {
      this.db.prepare('INSERT INTO decks (id, name, created_at) VALUES (?, ?, ?)').run(
        SQLiteStorage.DEFAULT_DECK_ID,
        'Default',
        new Date().toISOString()
      );
    }
  }

  // ===== Card Operations =====

  async getCards(): Promise<Card[]> {
    const rows = this.db.prepare('SELECT * FROM cards').all() as CardRow[];
    return rows.map(row => this.rowToCard(row));
  }

  async getCard(id: string): Promise<Card | undefined> {
    const row = this.db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
    return row ? this.rowToCard(row) : undefined;
  }

  async getCardsByDeck(deckId: string): Promise<Card[]> {
    const rows = this.db.prepare('SELECT * FROM cards WHERE deck_id = ?').all(deckId) as CardRow[];
    return rows.map(row => this.rowToCard(row));
  }

  async getCardsByTag(tag: string): Promise<Card[]> {
    const cards = await this.getCards();
    return cards.filter(card => card.tags.includes(tag));
  }

  async searchCards(query: string): Promise<Card[]> {
    const cards = await this.getCards();
    const lowerQuery = query.toLowerCase();
    return cards.filter(card =>
      card.front.toLowerCase().includes(lowerQuery) ||
      card.back.toLowerCase().includes(lowerQuery) ||
      card.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async getAllTags(): Promise<string[]> {
    const cards = await this.getCards();
    const tagsSet = new Set<string>();
    cards.forEach(card => {
      card.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }

  async saveCard(card: Omit<Card, 'id' | 'created_at'>): Promise<Card> {
    const newCard: Card = {
      ...card,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };

    this.db.prepare(`
      INSERT INTO cards (id, front, back, tags, due_at, interval, reps, ease, deck_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newCard.id,
      newCard.front,
      newCard.back,
      JSON.stringify(newCard.tags),
      newCard.due_at,
      newCard.interval,
      newCard.reps,
      newCard.ease,
      newCard.deckId,
      newCard.created_at
    );

    return newCard;
  }

  async updateCard(card: Card): Promise<void> {
    this.db.prepare(`
      UPDATE cards
      SET front = ?, back = ?, tags = ?, due_at = ?, interval = ?, reps = ?, ease = ?
      WHERE id = ?
    `).run(
      card.front,
      card.back,
      JSON.stringify(card.tags),
      card.due_at,
      card.interval,
      card.reps,
      card.ease,
      card.id
    );
  }

  async deleteCard(id: string): Promise<void> {
    this.db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  }

  // ===== Deck Operations =====

  async getDecks(): Promise<Deck[]> {
    const rows = this.db.prepare('SELECT * FROM decks').all() as DeckRow[];
    return Promise.all(rows.map(async row => {
      const cardIds = await this.getCardIdsByDeck(row.id);
      return {
        id: row.id,
        name: row.name,
        card_ids: cardIds,
        created_at: row.created_at
      };
    }));
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    const row = this.db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as DeckRow | undefined;
    if (!row) {
      return undefined;
    }

    const cardIds = await this.getCardIdsByDeck(id);
    return {
      id: row.id,
      name: row.name,
      card_ids: cardIds,
      created_at: row.created_at
    };
  }

  async createDeck(name: string): Promise<Deck> {
    const newDeck: Deck = {
      id: uuidv4(),
      name,
      card_ids: [],
      created_at: new Date().toISOString()
    };
    await this.saveDeck(newDeck);
    return newDeck;
  }

  async saveDeck(deck: Deck): Promise<void> {
    this.db.prepare('INSERT INTO decks (id, name, created_at) VALUES (?, ?, ?)').run(
      deck.id,
      deck.name,
      deck.created_at
    );
  }

  async updateDeck(deck: Deck): Promise<void> {
    this.db.prepare('UPDATE decks SET name = ? WHERE id = ?').run(deck.name, deck.id);
  }

  async deleteDeck(id: string): Promise<void> {
    if (id === SQLiteStorage.DEFAULT_DECK_ID) {
      throw new Error('Cannot delete default deck');
    }

    // Delete all cards in the deck first
    this.db.prepare('DELETE FROM cards WHERE deck_id = ?').run(id);

    // Delete the deck
    this.db.prepare('DELETE FROM decks WHERE id = ?').run(id);
  }

  async getDefaultDeck(): Promise<Deck> {
    const deck = await this.getDeck(SQLiteStorage.DEFAULT_DECK_ID);
    if (!deck) {
      throw new Error('Default deck not found');
    }
    return deck;
  }

  // ===== Helper Methods =====

  private rowToCard(row: CardRow): Card {
    return {
      id: row.id,
      front: row.front,
      back: row.back,
      tags: JSON.parse(row.tags || '[]'),
      due_at: row.due_at,
      interval: row.interval,
      reps: row.reps,
      ease: row.ease,
      deckId: row.deck_id,
      created_at: row.created_at
    };
  }

  private async getCardIdsByDeck(deckId: string): Promise<string[]> {
    const rows = this.db.prepare('SELECT id FROM cards WHERE deck_id = ?').all(deckId) as any[];
    return rows.map(row => row.id);
  }

  close(): void {
    this.db.close();
  }
}
