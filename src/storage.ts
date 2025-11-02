import * as vscode from 'vscode';
import { Card, Deck } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage manager for cards and decks using VSCode globalState
 */
export class StorageManager {
  private context: vscode.ExtensionContext;
  private static readonly CARDS_KEY = 'kioku.cards';
  private static readonly DECKS_KEY = 'kioku.decks';
  private static readonly DEFAULT_DECK_ID = 'default';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeDefaultDeck();
  }

  /**
   * Initialize default deck if it doesn't exist
   */
  private async initializeDefaultDeck(): Promise<void> {
    const decks = await this.getDecks();
    if (decks.length === 0) {
      const defaultDeck: Deck = {
        id: StorageManager.DEFAULT_DECK_ID,
        name: 'Default',
        card_ids: [],
        created_at: new Date().toISOString()
      };
      await this.saveDeck(defaultDeck);
    }
  }

  // ===== Card Operations =====

  /**
   * Get all cards
   */
  async getCards(): Promise<Card[]> {
    return this.context.globalState.get<Card[]>(StorageManager.CARDS_KEY, []);
  }

  /**
   * Get a single card by ID
   */
  async getCard(id: string): Promise<Card | undefined> {
    const cards = await this.getCards();
    return cards.find(card => card.id === id);
  }

  /**
   * Get cards by deck ID
   */
  async getCardsByDeck(deckId: string): Promise<Card[]> {
    const cards = await this.getCards();
    return cards.filter(card => card.deckId === deckId);
  }

  /**
   * Save a new card
   */
  async saveCard(card: Omit<Card, 'id' | 'created_at'>): Promise<Card> {
    const cards = await this.getCards();

    const newCard: Card = {
      ...card,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };

    cards.push(newCard);
    await this.context.globalState.update(StorageManager.CARDS_KEY, cards);

    // Update deck's card_ids
    const deck = await this.getDeck(card.deckId);
    if (deck) {
      deck.card_ids.push(newCard.id);
      await this.updateDeck(deck);
    }

    return newCard;
  }

  /**
   * Update an existing card
   */
  async updateCard(card: Card): Promise<void> {
    const cards = await this.getCards();
    const index = cards.findIndex(c => c.id === card.id);

    if (index !== -1) {
      cards[index] = card;
      await this.context.globalState.update(StorageManager.CARDS_KEY, cards);
    }
  }

  /**
   * Delete a card
   */
  async deleteCard(id: string): Promise<void> {
    const cards = await this.getCards();
    const card = cards.find(c => c.id === id);

    if (card) {
      // Remove from deck
      const deck = await this.getDeck(card.deckId);
      if (deck) {
        deck.card_ids = deck.card_ids.filter(cardId => cardId !== id);
        await this.updateDeck(deck);
      }

      // Remove card
      const filteredCards = cards.filter(c => c.id !== id);
      await this.context.globalState.update(StorageManager.CARDS_KEY, filteredCards);
    }
  }

  // ===== Deck Operations =====

  /**
   * Get all decks
   */
  async getDecks(): Promise<Deck[]> {
    return this.context.globalState.get<Deck[]>(StorageManager.DECKS_KEY, []);
  }

  /**
   * Get a single deck by ID
   */
  async getDeck(id: string): Promise<Deck | undefined> {
    const decks = await this.getDecks();
    return decks.find(deck => deck.id === id);
  }

  /**
   * Save a new deck
   */
  async saveDeck(deck: Deck): Promise<void> {
    const decks = await this.getDecks();
    decks.push(deck);
    await this.context.globalState.update(StorageManager.DECKS_KEY, decks);
  }

  /**
   * Update an existing deck
   */
  async updateDeck(deck: Deck): Promise<void> {
    const decks = await this.getDecks();
    const index = decks.findIndex(d => d.id === deck.id);

    if (index !== -1) {
      decks[index] = deck;
      await this.context.globalState.update(StorageManager.DECKS_KEY, decks);
    }
  }

  /**
   * Delete a deck and all its cards
   */
  async deleteDeck(id: string): Promise<void> {
    // Don't allow deleting default deck
    if (id === StorageManager.DEFAULT_DECK_ID) {
      throw new Error('Cannot delete default deck');
    }

    const deck = await this.getDeck(id);
    if (deck) {
      // Delete all cards in the deck
      for (const cardId of deck.card_ids) {
        await this.deleteCard(cardId);
      }

      // Delete the deck
      const decks = await this.getDecks();
      const filteredDecks = decks.filter(d => d.id !== id);
      await this.context.globalState.update(StorageManager.DECKS_KEY, filteredDecks);
    }
  }

  /**
   * Get default deck
   */
  async getDefaultDeck(): Promise<Deck> {
    const deck = await this.getDeck(StorageManager.DEFAULT_DECK_ID);
    if (!deck) {
      throw new Error('Default deck not found');
    }
    return deck;
  }
}
