import * as vscode from 'vscode';
import { Card, Deck, ReviewMode } from './types';
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
   * Get cards by tag
   */
  async getCardsByTag(tag: string): Promise<Card[]> {
    const cards = await this.getCards();
    return cards.filter(card => card.tags.includes(tag));
  }

  /**
   * Search cards by front or back text
   */
  async searchCards(query: string): Promise<Card[]> {
    const cards = await this.getCards();
    const lowerQuery = query.toLowerCase();
    return cards.filter(card =>
      card.front.toLowerCase().includes(lowerQuery) ||
      card.back.toLowerCase().includes(lowerQuery) ||
      card.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all unique tags
   */
  async getAllTags(): Promise<string[]> {
    const cards = await this.getCards();
    const tagsSet = new Set<string>();
    cards.forEach(card => {
      card.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
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
    const decks = this.context.globalState.get<Deck[]>(StorageManager.DECKS_KEY, []);
    // Remove duplicates by ID
    const uniqueDecks = decks.filter((deck, index, self) =>
      index === self.findIndex(d => d.id === deck.id)
    );
    return uniqueDecks;
  }

  /**
   * Get a single deck by ID
   */
  async getDeck(id: string): Promise<Deck | undefined> {
    const decks = await this.getDecks();
    return decks.find(deck => deck.id === id);
  }

  /**
   * Create a new deck
   */
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

  /**
   * Update deck's review mode
   */
  async updateDeckReviewMode(deckId: string, reviewMode: ReviewMode): Promise<void> {
    const deck = await this.getDeck(deckId);
    if (deck) {
      deck.reviewMode = reviewMode;
      await this.updateDeck(deck);
    }
  }
}
