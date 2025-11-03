# Kioku - VSCode Flashcard Extension

[![CI](https://github.com/Justhiro55/Kioku/actions/workflows/ci.yml/badge.svg)](https://github.com/Justhiro55/Kioku/actions/workflows/ci.yml)
[![Release](https://github.com/Justhiro55/Kioku/actions/workflows/release.yml/badge.svg)](https://github.com/Justhiro55/Kioku/actions/workflows/release.yml)
[![Version](https://img.shields.io/github/v/release/Justhiro55/Kioku)](https://github.com/Justhiro55/Kioku/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🧠 A powerful flashcard learning extension for VSCode with spaced repetition.

## Features

### Core Learning
- **📝 Quick Card Creation**: Select text in your editor and convert it to flashcards
- **🔄 Spaced Repetition**: Built-in SM-2 algorithm for optimal learning
- **✍️ Spell Mode**: Type answers to actively recall information
- **🎨 Modern Review UI**: Beautiful webview-based review interface

### Organization
- **📁 Deck Management**: Create and organize multiple decks
- **🏷️ Tags**: Categorize cards with tags
- **🔍 Search**: Find cards by front, back, or tags
- **🎯 Filtering**: Filter cards by tags or search query

### Data Management
- **💾 Flexible Storage**: Choose between globalState or SQLite
- **📝 Markdown Import/Export**: Import decks from markdown files (engineer-friendly!)
- **📊 CSV/JSON Support**: Share and backup your cards in multiple formats
- **🔄 Easy Migration**: One-click migration to SQLite

### Progress Tracking
- **📈 Statistics Dashboard**: View your learning progress
- **📅 Contribution Calendar**: GitHub-style calendar showing daily reviews
- **🔥 Streak Tracking**: Track consecutive learning days
- **📊 Accuracy Metrics**: Monitor your performance over time

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/Justhiro55/Kioku.git
   cd Kioku
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Press `F5` in VSCode to launch the Extension Development Host

## Usage

### Creating Cards

#### From Markdown (Recommended for Engineers! 🚀)
1. Create a `.md` file with your cards:
   ```markdown
   # JavaScript Basics

   ## const
   再代入不可の定数宣言
   - Tags: es6, variable

   ## let
   ブロックスコープの変数宣言
   - Tags: es6, variable
   ```
2. Open the file in VSCode
3. Run `Kioku: Create Cards from Current Markdown File`
4. Done! All cards imported automatically.

See [example-deck.md](example-deck.md) for a complete example.

#### From Selection
1. Select text in any editor (format: `word - meaning`)
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Kioku: Add from Selection`
4. Enter front, back, and optional tags

### Reviewing Cards

1. Click **Start Review** button in Kioku sidebar (or use Command Palette)
2. Press Space/Enter to reveal answer
3. Rate using keyboard shortcuts:
   - `1` - Again (forgot)
   - `2` - Hard (difficult recall)
   - `3` - Good (correct)
   - `4` - Easy (instant recall)
4. Press `Cmd+Z` (Mac) / `Ctrl+Z` (Windows) to undo last rating

### Managing Decks

- Click the Kioku icon in the Activity Bar
- Click the + button to create a new deck
- Right-click on decks to delete
- Cards with 📌 are due for review

### Viewing Statistics

1. Open Command Palette
2. Run `Kioku: Show Statistics`
3. View your learning calendar, streak, and accuracy

## Commands

### Learning
- `Kioku: Add from Selection` - Create card from selected text
- `Kioku: Start Review` - Begin review session
- `Kioku: Edit Card` - Edit an existing card
- `Kioku: Delete Card` - Delete a card

### Organization
- `Kioku: Create Deck` - Create a new deck
- `Kioku: Delete Deck` - Delete a deck
- `Kioku: Search Cards` - Search across all cards
- `Kioku: Filter by Tag` - Filter cards by tag
- `Kioku: Clear Filters` - Remove all filters

### Data
- `Kioku: Import from Markdown` - Import deck from markdown file
- `Kioku: Create Cards from Current Markdown File` - Quick import from open file
- `Kioku: Export to Markdown` - Export deck to markdown
- `Kioku: Export to CSV` - Export all cards
- `Kioku: Import from CSV` - Import cards from CSV
- `Kioku: Import from JSON` - Import cards from JSON
- `Kioku: Export to JSON` - Export cards to JSON
- `Kioku: Migrate to SQLite` - Migrate to SQLite storage

### Analytics
- `Kioku: Show Statistics` - View learning statistics

## Settings

- `kioku.useWebview` (default: `true`) - Use webview UI for reviews
- `kioku.spellMode` (default: `true`) - Enable typing answers
- `kioku.reviewAlgorithm` (default: `"sm2"`) - Algorithm: `"sm2"` or `"basic"`
- `kioku.storageType` (default: `"globalState"`) - Storage: `"globalState"` or `"sqlite"`

## Spaced Repetition (SM-2)

Kioku uses the SuperMemo 2 (SM-2) algorithm:

- **5 - Perfect ✨**: Instant recall
- **4 - Good ✅**: Correct after brief thought
- **3 - OK 👍**: Correct with difficulty
- **2 - Hard 😓**: Incorrect but recognized
- **1 - Again 🔄**: Barely recalled
- **0 - Forgot ❌**: Complete blackout

Cards are automatically scheduled based on your performance.

## Development Status

### Sprint 1 (MVP) ✅
- [x] Card CRUD operations
- [x] Add from selection
- [x] Basic review mode
- [x] TreeView sidebar
- [x] Status bar
- [x] SM-2 algorithm

### Sprint 2 (Enhanced UX) ✅
- [x] Webview-based review UI
- [x] Card editing
- [x] Deck management
- [x] CSV import/export

### Sprint 3 (Data & Search) ✅
- [x] SQLite storage backend
- [x] Tags and filtering
- [x] Search functionality
- [x] Migration tool

### Sprint 4 (Analytics) ✅
- [x] Review session tracking
- [x] Contribution calendar
- [x] Statistics dashboard
- [x] Streak calculation

### Sprint 5 (Markdown & UX) ✅
- [x] Markdown import/export
- [x] Undo functionality (Cmd+Z)
- [x] Review start button in sidebar
- [x] Enhanced streak visualization

### Future Enhancements
- [ ] GitHub OAuth integration
- [ ] Cloud sync via Gist
- [ ] Media support (images, audio)
- [ ] AI card generation
- [ ] Gamification (XP, badges)

## Architecture

```
src/
├── extension.ts          # Main entry point
├── types.ts             # Type definitions
├── storage.ts           # GlobalState storage
├── sqliteStorage.ts     # SQLite storage
├── sm2.ts               # Spaced repetition algorithm
├── statistics.ts        # Session tracking
├── deckTreeProvider.ts  # Sidebar UI
├── reviewWebview.ts     # Review UI
├── statsWebview.ts      # Statistics UI
├── csvHandler.ts        # Import/export
├── filterManager.ts     # Filtering logic
└── migration.ts         # Data migration
```

## Development

### Prerequisites

- Node.js 18.x or higher
- VSCode 1.85.0 or higher

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Lint

```bash
npm run lint
```

### Debug

Press `F5` in VSCode to launch the extension in debug mode.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

If you find this extension helpful, please star the repository and share it with others!

---

Made with ❤️ for learners who code
