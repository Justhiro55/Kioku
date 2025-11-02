# Changelog

All notable changes to the Kioku extension will be documented in this file.

## [0.4.0] - Sprint 4: Analytics & Progress Tracking

### Added
- **Review Session Tracking**: Automatic recording of review sessions with accuracy and duration
- **Statistics Dashboard**: Comprehensive view of learning progress with `Kioku: Show Statistics`
- **Contribution Calendar**: GitHub-style calendar visualization showing daily review activity (90 days)
- **Streak Tracking**: Calculate and display consecutive learning days with 1-day grace period
- **Accuracy Metrics**: Track correct answers (quality >= 3) and display accuracy rate

### Changed
- Review completion message now shows accuracy percentage
- Enhanced webview UI with session statistics

## [0.3.0] - Sprint 3: Data & Search

### Added
- **Tag Management**: Add tags when creating/editing cards
- **Tag Filtering**: `Kioku: Filter by Tag` command to filter cards by tag
- **Search Functionality**: `Kioku: Search Cards` to search by front, back, or tags
- **SQLite Storage Backend**: High-performance database storage option
- **Migration Tool**: `Kioku: Migrate to SQLite` for easy data migration
- **Filter Manager**: Centralized filtering system with visual indicators
- **Clear Filters**: `Kioku: Clear Filters` command

### Changed
- TreeView now displays tags on cards
- Storage interface supports tag-based queries
- Enhanced card tooltips with tag information

## [0.2.0] - Sprint 2: Enhanced UX

### Added
- **Webview Review UI**: Modern, card-based review interface with progress bar
- **Card Editing**: `Kioku: Edit Card` command and context menu
- **Card Deletion**: `Kioku: Delete Card` with confirmation dialog
- **Deck Management**: Create and delete decks via `Kioku: Create Deck` and `Kioku: Delete Deck`
- **CSV Import/Export**: Share and backup cards with `Kioku: Export to CSV` and `Kioku: Import from CSV`
- **Context Menus**: Right-click cards and decks in sidebar for quick actions

### Changed
- Review interface now uses webview by default (configurable via `kioku.useWebview`)
- Input box review mode available as fallback
- Enhanced deck tree view with inline buttons

## [0.1.0] - Sprint 1: MVP

### Added
- **Card CRUD**: Create, read, update, and delete flashcards
- **Add from Selection**: Create cards from selected text in editor
- **SM-2 Algorithm**: Spaced repetition with SuperMemo 2 algorithm
- **Review System**: Interactive review with 0-5 quality ratings
- **Spell Mode**: Type answers for active recall
- **TreeView Sidebar**: Visual deck and card management
- **Status Bar**: Display due card count
- **GlobalState Storage**: Persistent local storage
- **Default Deck**: Automatic default deck creation

### Commands
- `Kioku: Add from Selection`
- `Kioku: Start Review`
- `Kioku: Open Deck`

### Settings
- `kioku.spellMode`: Enable/disable spell input mode
- `kioku.reviewAlgorithm`: Choose between SM-2 or basic algorithm
- `kioku.storageType`: Select storage backend

## [Unreleased]

### Planned Features
- GitHub OAuth integration for cloud sync
- Gist-based backup and sync
- Media support (images, audio)
- AI-powered card generation
- Gamification (XP, levels, badges)
- Import from Anki format
- Mobile companion app
