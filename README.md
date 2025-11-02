# Kioku - VSCode Flashcard Extension

🧠 A powerful flashcard learning extension for VSCode with spaced repetition.

## Features

- **📝 Quick Card Creation**: Select text in your editor and convert it to flashcards
- **🔄 Spaced Repetition**: Built-in SM-2 algorithm for optimal learning
- **✍️ Spell Mode**: Type answers to actively recall information
- **📊 Visual Progress**: Track your learning with deck views and due card counters
- **💾 Local Storage**: All data stored locally in VSCode's global state

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/kioku.git
   cd kioku
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

1. Select text in any editor (format: `word - meaning`)
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Kioku: Add from Selection`
4. Adjust front/back if needed

### Reviewing Cards

1. Open Command Palette
2. Run `Kioku: Start Review`
3. Type your answer (if spell mode is enabled)
4. Rate how well you remembered (0-5)

### Viewing Decks

- Click the Kioku icon in the Activity Bar
- See all your decks and due cards
- Cards with 📌 are due for review

### Status Bar

The status bar shows how many cards are due for review. Click it to start a review session.

## Commands

- `Kioku: Add from Selection` - Create card from selected text
- `Kioku: Start Review` - Begin review session
- `Kioku: Open Deck` - View deck details

## Settings

- `kioku.spellMode` (default: `true`) - Enable typing answers
- `kioku.reviewAlgorithm` (default: `"sm2"`) - Algorithm: `"sm2"` or `"basic"`
- `kioku.storageType` (default: `"globalState"`) - Storage backend

## Spaced Repetition (SM-2)

Kioku uses the SuperMemo 2 (SM-2) algorithm:

- **5 - Perfect**: Instant recall
- **4 - Good**: Correct after brief thought
- **3 - OK**: Correct with difficulty
- **2 - Hard**: Incorrect but recognized
- **1 - Again**: Barely recalled
- **0 - Forgot**: Complete blackout

Cards are automatically scheduled based on your performance.

## Roadmap

### Sprint 1 (MVP) ✅
- [x] Card CRUD operations
- [x] Add from selection
- [x] Basic review mode
- [x] TreeView sidebar
- [x] Status bar
- [x] SM-2 algorithm

### Sprint 2 (Planned)
- [ ] Webview-based review UI
- [ ] Card editing
- [ ] Deck management
- [ ] CSV import/export

### Sprint 3 (Planned)
- [ ] SQLite storage backend
- [ ] Tags and filtering
- [ ] Search functionality

### Sprint 4 (Planned)
- [ ] GitHub integration
- [ ] Contribution calendar
- [ ] Statistics dashboard

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
