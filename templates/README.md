# Kioku Template Decks

This directory contains **ready-to-use flashcard decks** for Kioku. Import them to start learning immediately!

## 📥 How to Import Templates

### Method 1: Command Palette (⌘+Shift+P / Ctrl+Shift+P)
1. Open Command Palette
2. Type `Kioku: Import from Markdown`
3. Navigate to this `templates/` folder
4. Select one of the `.md` files below
5. Cards are automatically created!

### Method 2: Home Screen
1. Click **🧠 Kioku** icon in the Activity Bar
2. Click **Home** button
3. Click **📥 Import Deck from Markdown**
4. Navigate to `templates/` and select a template

### Method 3: Drag & Drop
1. Open the template `.md` file in VSCode
2. Run `Kioku: Create Cards from Current Markdown File`
3. Instant import!

---

## 📚 Available Templates

### 🇬🇧 TOEIC Golden Words (600 Level)
**File:** `toeic/golden-word.md`
**Cards:** 100 essential business vocabulary words

Perfect for Japanese speakers preparing for TOEIC!

- **Target Score:** 600
- **Categories:**
  - Basic Business Vocabulary
  - Office & Workplace
  - Finance & Economy
  - Customer Service
- **Format:** English word → Japanese definition
- **Example:**
  ```
  Front: accomplish
  Back: 達成する、成し遂げる
  ```

**Who should use this:**
- TOEIC test takers targeting 600+ score
- Japanese business professionals learning English
- Students preparing for job interviews in English

---

### 💻 基本情報技術者試験 (Fundamental IT Engineer Exam)
**File:** `kihon-joho/basic-terms.md`
**Cards:** 100 key technical terms

Ideal for 基本情報技術者試験 preparation!

- **Topics Covered:**
  - **Computer Architecture:** CPU, ALU, Cache, Memory
  - **Networking:** TCP/IP, OSI Model, DNS, HTTP
  - **Databases:** SQL, Normalization, ACID, Index
  - **Security:** Encryption, Authentication, Firewall
  - **Software Engineering:** Design Patterns, Testing, Version Control
  - **Algorithms & Data Structures:** Sorting, Searching, Trees, Graphs

- **Format:** Technical term → Japanese explanation
- **Example:**
  ```
  Front: CPU (Central Processing Unit)
  Back: 中央処理装置。コンピュータの中心となる演算・制御を行う装置
  ```

**Who should use this:**
- Students preparing for 基本情報技術者試験 (FE Exam)
- IT beginners learning fundamental concepts
- Engineers reviewing basic computer science topics

---

### 🇯🇵 JLPT N5 Vocabulary
**File:** `japanese-learning/jlpt-n5-vocabulary.md`
**Cards:** 150 basic Japanese words

Perfect for JLPT N5 exam preparation or Japanese beginners!

- **Categories:**
  - **Greetings & Daily Expressions:** おはよう, ありがとう, すみません
  - **Numbers & Counting:** 一、二、三、何
  - **Time & Calendar:** 今日、明日、月、年
  - **Family & People:** お父さん、お母さん、友達
  - **Food & Drinks:** 水、お茶、ご飯、魚
  - **Places & Directions:** 駅、学校、病院、右、左
  - **Common Adjectives:** 大きい、小さい、高い、安い
  - **Common Verbs:** 行く、来る、食べる、飲む

- **Format:** Japanese (romaji) → English translation
- **Example:**
  ```
  Front: おはよう (ohayou)
  Back: Good morning (casual)
  ```

**Who should use this:**
- JLPT N5 exam candidates
- Absolute beginners in Japanese
- Travelers learning survival Japanese
- Students starting Japanese language courses

---

## 🎯 Creating Your Own Templates

Want to create custom flashcard decks? It's easy! Just follow the Markdown format:

### Basic Format

```markdown
# Your Deck Name

## Card Front 1
Card back explanation

## Card Front 2
Card back explanation
```

### Advanced Format with Categories

```markdown
# My Custom Deck

## Category 1

### Card Front 1
Card back explanation

### Card Front 2
Card back explanation

## Category 2

### Card Front 3
Card back explanation
```

### Tips for Creating Templates

1. **Use H2 (##) for card fronts** - Each heading becomes the front of a card
2. **Paragraphs are card backs** - The text below each heading is the back
3. **Keep it concise** - Short, focused cards work best for retention
4. **Add context** - Include examples or additional info on the back
5. **Group by topic** - Use H1 for deck name, H2 for categories (optional)

### Example: Creating a Git Commands Deck

```markdown
# Git Commands

## git init
Initialize a new Git repository in the current directory

## git clone [url]
Create a local copy of a remote repository

## git add [file]
Stage changes for the next commit

## git commit -m "[message]"
Save staged changes with a descriptive message

## git push
Upload local commits to remote repository

## git pull
Download and merge changes from remote repository
```

Save this as `git-commands.md` and import it using any of the methods above!

---

## 📝 Template File Format

All templates use standard Markdown with this structure:

```
# Deck Name (H1) - Optional, becomes deck name

## Card Front (H2) - Required
Card back content (paragraph) - Required

## Another Card Front (H2)
Another card back content
```

**Key Points:**
- H1 (`#`) - Deck name (optional, defaults to filename)
- H2 (`##`) - Card front (required)
- Paragraph text - Card back (required, appears after H2)
- H3+ headings can be used for organization but won't create cards

---

## 🌐 Sharing Templates

Want to share your templates with others?

1. **Create a GitHub Gist:**
   - Upload your `.md` file to [gist.github.com](https://gist.github.com)
   - Share the Gist URL

2. **Import from URL:**
   - Run `Kioku: Import Deck from URL`
   - Paste the Gist URL
   - Cards are imported instantly!

3. **Copy to Clipboard:**
   - Run `Kioku: Share Deck`
   - Select your deck
   - Markdown is copied to clipboard
   - Share with friends or post online!

---

## 🤝 Contributing Templates

Have a great template deck to share? Contribute to Kioku!

1. Create your template `.md` file
2. Test it by importing into Kioku
3. Submit a Pull Request to [Kioku GitHub](https://github.com/Justhiro55/Kioku)
4. Add it to this README

**Template ideas we'd love to see:**
- Programming language syntax (Python, JavaScript, Rust)
- Interview preparation (System Design, Algorithms)
- Language learning (Spanish, French, Chinese)
- Medical terminology
- Legal terms
- History dates and events
- Science formulas and concepts

---

## 📖 Learn More

- [Kioku Documentation](../README.md)
- [Spaced Repetition (SM-2 Algorithm)](https://en.wikipedia.org/wiki/SuperMemo#SM-2_algorithm)
- [Effective Flashcard Creation](https://www.supermemo.com/en/archives1990-2015/articles/20rules)

---

**Happy Learning! 📚✨**
