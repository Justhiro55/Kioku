import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { DeckTreeProvider } from './deckTreeProvider';
import { ReviewWebviewProvider } from './reviewWebview';
import { StatsWebviewProvider } from './statsWebview';
import { exportCardsToCSV, importCardsFromCSV } from './csvHandler';
import { importFromJSON, createFromJSONFile, exportToJSON } from './jsonHandler';
import { MarkdownHandler } from './markdownHandler';
import { GistHandler } from './gistHandler';
import { FilterManager } from './filterManager';
import { StatisticsManager } from './statistics';
import { migrateToSQLite } from './migration';
import { Card } from './types';
import { SM2Algorithm } from './sm2';

let storage: StorageManager;
let deckTreeProvider: DeckTreeProvider;
let filterManager: FilterManager;
let statisticsManager: StatisticsManager;
let statusBarItem: vscode.StatusBarItem;
let context: vscode.ExtensionContext;

export function activate(ctx: vscode.ExtensionContext) {
  console.log('Kioku extension is now active');

  context = ctx;

  // Initialize storage
  storage = new StorageManager(context);

  // Initialize filter manager
  filterManager = new FilterManager();

  // Initialize statistics manager
  statisticsManager = new StatisticsManager(context);

  // Initialize tree view
  deckTreeProvider = new DeckTreeProvider(storage);
  vscode.window.registerTreeDataProvider('kioku-decks', deckTreeProvider);

  // Refresh tree view when filters change
  filterManager.onDidChangeFilter(() => deckTreeProvider.refresh());

  // Initialize status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'kioku.startReview';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('kioku.addFromSelection', addFromSelection),
    vscode.commands.registerCommand('kioku.startReview', startReview),
    vscode.commands.registerCommand('kioku.openDeck', openDeck),
    vscode.commands.registerCommand('kioku.editCard', editCard),
    vscode.commands.registerCommand('kioku.deleteCard', deleteCard),
    vscode.commands.registerCommand('kioku.createDeck', createDeck),
    vscode.commands.registerCommand('kioku.deleteDeck', deleteDeck),
    vscode.commands.registerCommand('kioku.exportCSV', () => exportCardsToCSV(storage)),
    vscode.commands.registerCommand('kioku.importCSV', async () => {
      await importCardsFromCSV(storage);
      deckTreeProvider.refresh();
      updateStatusBar();
    }),
    vscode.commands.registerCommand('kioku.importJSON', async () => {
      await importFromJSON(storage);
      deckTreeProvider.refresh();
      updateStatusBar();
    }),
    vscode.commands.registerCommand('kioku.exportJSON', () => exportToJSON(storage)),
    vscode.commands.registerCommand('kioku.createFromJSON', async () => {
      await createFromJSONFile(storage);
      deckTreeProvider.refresh();
      updateStatusBar();
    }),
    vscode.commands.registerCommand('kioku.importMarkdown', async () => {
      const result = await MarkdownHandler.importFromMarkdown(storage);
      if (result) {
        vscode.window.showInformationMessage(
          `Imported ${result.cardsCount} cards to deck "${result.deckName}"`
        );
        deckTreeProvider.refresh();
        updateStatusBar();
      }
    }),
    vscode.commands.registerCommand('kioku.createFromMarkdown', async () => {
      const result = await MarkdownHandler.createFromCurrentMarkdownFile(storage);
      if (result) {
        vscode.window.showInformationMessage(
          `Created ${result.cardsCount} cards in deck "${result.deckName}"`
        );
        deckTreeProvider.refresh();
        updateStatusBar();
      }
    }),
    vscode.commands.registerCommand('kioku.exportMarkdown', () => MarkdownHandler.exportToMarkdown(storage)),
    vscode.commands.registerCommand('kioku.importFromURL', async () => {
      const result = await GistHandler.importFromURL(storage);
      if (result) {
        vscode.window.showInformationMessage(
          `Imported ${result.cardsCount} cards to deck "${result.deckName}"`
        );
        deckTreeProvider.refresh();
        updateStatusBar();
      }
    }),
    vscode.commands.registerCommand('kioku.shareDeck', () => GistHandler.shareDeckAsMarkdown(storage)),
    vscode.commands.registerCommand('kioku.searchCards', searchCards),
    vscode.commands.registerCommand('kioku.filterByTag', filterByTag),
    vscode.commands.registerCommand('kioku.clearFilters', clearFilters),
    vscode.commands.registerCommand('kioku.showStats', showStats),
    vscode.commands.registerCommand('kioku.migrateToSQLite', () => migrateToSQLite(context)),
    vscode.commands.registerCommand('kioku.refreshDecks', () => deckTreeProvider.refresh())
  );

  // Refresh status bar periodically
  setInterval(updateStatusBar, 60000); // Every minute
}

/**
 * Add a card from selected text
 */
async function addFromSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  // Try to parse "front - back" format
  let front = selection;
  let back = '';

  const dashIndex = selection.indexOf(' - ');
  if (dashIndex !== -1) {
    front = selection.substring(0, dashIndex).trim();
    back = selection.substring(dashIndex + 3).trim();
  }

  // Show input boxes for front and back
  front = await vscode.window.showInputBox({
    prompt: 'Front of the card (question)',
    value: front,
    placeHolder: 'e.g., apple'
  }) || '';

  if (!front) {
    return;
  }

  back = await vscode.window.showInputBox({
    prompt: 'Back of the card (answer)',
    value: back,
    placeHolder: 'e.g., りんご'
  }) || '';

  if (!back) {
    return;
  }

  // Optional: Add tags
  const tagsInput = await vscode.window.showInputBox({
    prompt: 'Tags (comma-separated, optional)',
    placeHolder: 'e.g., vocabulary, japanese'
  }) || '';

  const tags = tagsInput
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // Get default deck
  const defaultDeck = await storage.getDefaultDeck();

  // Create card with initial SM-2 values
  const now = new Date();
  const card: Omit<Card, 'id' | 'created_at'> = {
    front,
    back,
    tags,
    due_at: now.toISOString(), // Due immediately
    interval: 0,
    reps: 0,
    ease: 2.5, // Default ease factor
    deckId: defaultDeck.id
  };

  await storage.saveCard(card);
  vscode.window.showInformationMessage(`Card added: ${front}`);

  // Refresh views
  deckTreeProvider.refresh();
  updateStatusBar();
}

/**
 * Start review session
 */
async function startReview() {
  const config = vscode.workspace.getConfiguration('kioku');
  const useWebview = config.get<boolean>('useWebview', true);

  if (useWebview) {
    const webviewProvider = new ReviewWebviewProvider(
      context,
      storage,
      () => {
        deckTreeProvider.refresh();
        updateStatusBar();
      }
    );
    await webviewProvider.show();
  } else {
    // Fallback to input box mode
    await startReviewInputMode();
  }
}

/**
 * Start review session with input boxes (legacy mode)
 */
async function startReviewInputMode() {
  const allCards = await storage.getCards();
  const dueCards = SM2Algorithm.getDueCards(allCards);

  if (dueCards.length === 0) {
    vscode.window.showInformationMessage('No cards due for review! 🎉');
    return;
  }

  // Review cards one by one
  for (const card of dueCards) {
    const shouldContinue = await reviewCard(card);
    if (!shouldContinue) {
      break;
    }
  }

  vscode.window.showInformationMessage('Review session completed! 🎉');
  deckTreeProvider.refresh();
  updateStatusBar();
}

/**
 * Review a single card
 */
async function reviewCard(card: Card): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('kioku');
  const spellMode = config.get<boolean>('spellMode', true);

  // Show front
  const answer = await vscode.window.showInputBox({
    prompt: `Review: ${card.front}`,
    placeHolder: spellMode ? 'Type your answer' : 'Press Enter to see answer',
    ignoreFocusOut: true
  });

  if (answer === undefined) {
    // User cancelled
    return false;
  }

  // Calculate quality based on spell check if enabled
  let quality = 3; // Default: correct with difficulty

  if (spellMode && answer) {
    const correct = answer.trim().toLowerCase() === card.back.trim().toLowerCase();
    const similarity = calculateSimilarity(answer.trim().toLowerCase(), card.back.trim().toLowerCase());

    if (correct) {
      quality = 5; // Perfect
    } else if (similarity > 0.8) {
      quality = 4; // Close
    } else if (similarity > 0.5) {
      quality = 3; // Somewhat close
    } else {
      quality = 2; // Incorrect but tried
    }
  }

  // Show answer and let user rate
  const rating = await vscode.window.showQuickPick([
    { label: '5 - Perfect ✨', quality: 5 },
    { label: '4 - Good ✅', quality: 4 },
    { label: '3 - OK 👍', quality: 3 },
    { label: '2 - Hard 😓', quality: 2 },
    { label: '1 - Again 🔄', quality: 1 },
    { label: '0 - Forgot ❌', quality: 0 }
  ], {
    placeHolder: `Answer: ${card.back}${spellMode ? ` (Auto-rated: ${quality})` : ''}`,
    ignoreFocusOut: true
  });

  if (!rating) {
    return false;
  }

  // Update card using SM-2
  const updatedCard = SM2Algorithm.calculateNextReview(card, rating.quality);
  await storage.updateCard(updatedCard);

  return true;
}

/**
 * Calculate string similarity (0-1)
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

/**
 * Open deck view
 */
async function openDeck() {
  const decks = await storage.getDecks();
  const deckItems = decks.map(deck => ({
    label: deck.name,
    description: `${deck.card_ids.length} cards`,
    deck
  }));

  const selected = await vscode.window.showQuickPick(deckItems, {
    placeHolder: 'Select a deck'
  });

  if (selected) {
    vscode.window.showInformationMessage(`Opening deck: ${selected.deck.name}`);
    // TODO: Open deck in webview or custom editor
  }
}

/**
 * Edit a card
 */
async function editCard(item: any) {
  let card: Card | undefined;

  if (item && item.card) {
    card = item.card;
  } else {
    // Select card from all cards
    const allCards = await storage.getCards();
    const cardItems = allCards.map(c => ({
      label: c.front,
      description: c.back,
      card: c
    }));

    const selected = await vscode.window.showQuickPick(cardItems, {
      placeHolder: 'Select a card to edit'
    });

    if (!selected) {
      return;
    }
    card = selected.card;
  }

  if (!card) {
    return;
  }

  // Edit front
  const newFront = await vscode.window.showInputBox({
    prompt: 'Front of the card',
    value: card.front,
    placeHolder: 'Question'
  });

  if (newFront === undefined) {
    return;
  }

  // Edit back
  const newBack = await vscode.window.showInputBox({
    prompt: 'Back of the card',
    value: card.back,
    placeHolder: 'Answer'
  });

  if (newBack === undefined) {
    return;
  }

  // Edit tags
  const newTagsInput = await vscode.window.showInputBox({
    prompt: 'Tags (comma-separated, optional)',
    value: card.tags.join(', '),
    placeHolder: 'e.g., vocabulary, japanese'
  });

  if (newTagsInput === undefined) {
    return;
  }

  const newTags = newTagsInput
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // Update card
  const updatedCard: Card = {
    ...card,
    front: newFront,
    back: newBack,
    tags: newTags
  };

  await storage.updateCard(updatedCard);
  vscode.window.showInformationMessage('Card updated');

  deckTreeProvider.refresh();
}

/**
 * Delete a card
 */
async function deleteCard(item: any) {
  let card: Card | undefined;

  if (item && item.card) {
    card = item.card;
  } else {
    // Select card from all cards
    const allCards = await storage.getCards();
    const cardItems = allCards.map(c => ({
      label: c.front,
      description: c.back,
      card: c
    }));

    const selected = await vscode.window.showQuickPick(cardItems, {
      placeHolder: 'Select a card to delete'
    });

    if (!selected) {
      return;
    }
    card = selected.card;
  }

  if (!card) {
    return;
  }

  // Confirm deletion
  const confirm = await vscode.window.showWarningMessage(
    `Delete card: "${card.front}"?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    await storage.deleteCard(card.id);
    vscode.window.showInformationMessage('Card deleted');

    deckTreeProvider.refresh();
    updateStatusBar();
  }
}

/**
 * Create a new deck
 */
async function createDeck() {
  const deckName = await vscode.window.showInputBox({
    prompt: 'Enter deck name',
    placeHolder: 'My Deck',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Deck name cannot be empty';
      }
      return null;
    }
  });

  if (!deckName) {
    return;
  }

  const newDeck = {
    id: `deck-${Date.now()}`,
    name: deckName,
    card_ids: [],
    created_at: new Date().toISOString()
  };

  await storage.saveDeck(newDeck);
  vscode.window.showInformationMessage(`Deck created: ${deckName}`);

  deckTreeProvider.refresh();
}

/**
 * Delete a deck
 */
async function deleteDeck(item: any) {
  let deckId: string | undefined;

  if (item && item.deck) {
    deckId = item.deck.id;
  } else {
    const decks = await storage.getDecks();
    const deckItems = decks.map(d => ({
      label: d.name,
      description: `${d.card_ids.length} cards`,
      id: d.id
    }));

    const selected = await vscode.window.showQuickPick(deckItems, {
      placeHolder: 'Select a deck to delete'
    });

    if (!selected) {
      return;
    }
    deckId = selected.id;
  }

  if (!deckId) {
    return;
  }

  const deck = await storage.getDeck(deckId);
  if (!deck) {
    return;
  }

  // Confirm deletion
  const confirm = await vscode.window.showWarningMessage(
    `Delete deck "${deck.name}" and all its ${deck.card_ids.length} cards?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    try {
      await storage.deleteDeck(deckId);
      vscode.window.showInformationMessage('Deck deleted');
      deckTreeProvider.refresh();
      updateStatusBar();
    } catch (error: any) {
      vscode.window.showErrorMessage(error.message);
    }
  }
}

/**
 * Search cards
 */
async function searchCards() {
  const query = await vscode.window.showInputBox({
    prompt: 'Search cards (front, back, or tags)',
    placeHolder: 'Enter search term...'
  });

  if (!query) {
    return;
  }

  const results = await storage.searchCards(query);

  if (results.length === 0) {
    vscode.window.showInformationMessage(`No cards found for "${query}"`);
    return;
  }

  const items = results.map(card => ({
    label: card.front,
    description: card.back,
    detail: card.tags.length > 0 ? `Tags: ${card.tags.join(', ')}` : undefined,
    card
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Found ${results.length} card(s)`
  });

  if (selected) {
    filterManager.setSearchQuery(query);
    vscode.window.showInformationMessage(`Filtered by search: "${query}"`);
  }
}

/**
 * Filter cards by tag
 */
async function filterByTag() {
  const allTags = await storage.getAllTags();

  if (allTags.length === 0) {
    vscode.window.showInformationMessage('No tags found');
    return;
  }

  const tagItems = allTags.map(tag => ({
    label: tag,
    tag
  }));

  const selected = await vscode.window.showQuickPick(tagItems, {
    placeHolder: 'Select a tag to filter'
  });

  if (selected) {
    filterManager.setTagFilter(selected.tag);
    vscode.window.showInformationMessage(`Filtered by tag: ${selected.tag}`);
  }
}

/**
 * Clear all filters
 */
function clearFilters() {
  filterManager.clearFilters();
  vscode.window.showInformationMessage('Filters cleared');
}

/**
 * Show statistics dashboard
 */
async function showStats() {
  const statsWebview = new StatsWebviewProvider(context, storage, statisticsManager);
  await statsWebview.show();
}

/**
 * Update status bar with review count
 */
async function updateStatusBar() {
  const allCards = await storage.getCards();
  const dueCards = SM2Algorithm.getDueCards(allCards);

  statusBarItem.text = `$(book) ${dueCards.length} due`;
  statusBarItem.tooltip = `${dueCards.length} cards due for review`;
  statusBarItem.show();
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
