import * as vscode from 'vscode';

/**
 * Manages filtering state for cards
 */
export class FilterManager {
  private _activeTagFilter: string | null = null;
  private _searchQuery: string | null = null;

  private _onDidChangeFilter = new vscode.EventEmitter<void>();
  public readonly onDidChangeFilter = this._onDidChangeFilter.event;

  get activeTagFilter(): string | null {
    return this._activeTagFilter;
  }

  get searchQuery(): string | null {
    return this._searchQuery;
  }

  setTagFilter(tag: string | null): void {
    this._activeTagFilter = tag;
    this._onDidChangeFilter.fire();
  }

  setSearchQuery(query: string | null): void {
    this._searchQuery = query;
    this._onDidChangeFilter.fire();
  }

  clearFilters(): void {
    this._activeTagFilter = null;
    this._searchQuery = null;
    this._onDidChangeFilter.fire();
  }

  hasActiveFilters(): boolean {
    return this._activeTagFilter !== null || this._searchQuery !== null;
  }

  getFilterDescription(): string {
    const parts: string[] = [];

    if (this._activeTagFilter) {
      parts.push(`Tag: ${this._activeTagFilter}`);
    }

    if (this._searchQuery) {
      parts.push(`Search: ${this._searchQuery}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No filters';
  }
}
