import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { SQLiteStorage } from './sqliteStorage';

/**
 * Migrate data from globalState to SQLite
 */
export async function migrateToSQLite(
  context: vscode.ExtensionContext
): Promise<void> {
  const globalStateStorage = new StorageManager(context);
  const sqliteStorage = new SQLiteStorage(context);

  try {
    // Get all data from globalState
    const decks = await globalStateStorage.getDecks();
    const cards = await globalStateStorage.getCards();

    if (decks.length === 0 && cards.length === 0) {
      vscode.window.showInformationMessage('No data to migrate');
      return;
    }

    // Confirm migration
    const confirm = await vscode.window.showWarningMessage(
      `Migrate ${decks.length} decks and ${cards.length} cards to SQLite?`,
      { modal: true },
      'Migrate'
    );

    if (confirm !== 'Migrate') {
      return;
    }

    // Migrate decks (skip default deck as it's auto-created)
    for (const deck of decks) {
      if (deck.id !== 'default') {
        try {
          await sqliteStorage.saveDeck(deck);
        } catch (error) {
          // Deck might already exist, skip
        }
      }
    }

    // Migrate cards
    let migratedCount = 0;
    for (const card of cards) {
      try {
        await sqliteStorage.saveCard({
          front: card.front,
          back: card.back,
          tags: card.tags,
          due_at: card.due_at,
          interval: card.interval,
          reps: card.reps,
          ease: card.ease,
          deckId: card.deckId
        });
        migratedCount++;
      } catch (error) {
        console.error('Failed to migrate card:', error);
      }
    }

    // Update storage type setting
    await vscode.workspace.getConfiguration('kioku').update(
      'storageType',
      'sqlite',
      vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage(
      `Migration complete! Migrated ${migratedCount} cards. Please reload VSCode.`
    );

  } catch (error: any) {
    vscode.window.showErrorMessage(`Migration failed: ${error.message}`);
  } finally {
    sqliteStorage.close();
  }
}

/**
 * Export SQLite data back to globalState (for backup/rollback)
 */
export async function exportToGlobalState(
  context: vscode.ExtensionContext
): Promise<void> {
  const sqliteStorage = new SQLiteStorage(context);
  const globalStateStorage = new StorageManager(context);

  try {
    const decks = await sqliteStorage.getDecks();
    const cards = await sqliteStorage.getCards();

    const confirm = await vscode.window.showWarningMessage(
      `Export ${decks.length} decks and ${cards.length} cards to globalState?`,
      { modal: true },
      'Export'
    );

    if (confirm !== 'Export') {
      return;
    }

    // Clear existing globalState data
    await context.globalState.update('kioku.decks', []);
    await context.globalState.update('kioku.cards', []);

    // Export decks
    for (const deck of decks) {
      await globalStateStorage.saveDeck(deck);
    }

    // Export cards
    for (const card of cards) {
      await globalStateStorage.updateCard(card);
    }

    vscode.window.showInformationMessage('Export to globalState complete!');

  } catch (error: any) {
    vscode.window.showErrorMessage(`Export failed: ${error.message}`);
  } finally {
    sqliteStorage.close();
  }
}
