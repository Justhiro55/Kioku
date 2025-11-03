# Testing Guide

## 開発モードでテスト

### 1. 起動方法

```bash
cd /Users/hiro/Documents/Kioku
code .
```

VSCodeで開いたら `F5` を押す

### 2. 基本機能テスト

#### カード作成
1. 新規ファイルを開く
2. テキストを選択: `apple - りんご`
3. `Cmd+Shift+P` → `Kioku: Add from Selection`
4. タグ入力: `fruit, vocabulary`

#### レビュー
1. `Cmd+Shift+P` → `Kioku: Start Review`
2. 答えを入力
3. 評価ボタンをクリック（0-5）

#### サイドバー
1. アクティビティバーの📚アイコンをクリック
2. デッキとカードを確認
3. カードを右クリック → Edit/Delete

#### 検索とフィルタ
1. `Cmd+Shift+P` → `Kioku: Search Cards`
2. `Cmd+Shift+P` → `Kioku: Filter by Tag`
3. `Cmd+Shift+P` → `Kioku: Clear Filters`

#### 統計確認
1. `Cmd+Shift+P` → `Kioku: Show Statistics`
2. カレンダーとストリークを確認

### 3. データ管理テスト

#### CSV エクスポート
1. `Cmd+Shift+P` → `Kioku: Export to CSV`
2. ファイル保存

#### CSV インポート
1. `Cmd+Shift+P` → `Kioku: Import from CSV`
2. CSVファイル選択

#### SQLite 移行
1. `Cmd+Shift+P` → `Kioku: Migrate to SQLite`
2. 確認ダイアログでMigrate

### 4. デバッグ方法

#### コンソール確認
- `Cmd+Shift+P` → `Developer: Toggle Developer Tools`
- Console タブでエラー確認

#### ブレークポイント
1. `src/extension.ts` などでブレークポイント設定
2. `F5` で再起動
3. デバッガーでステップ実行

### 5. ログ確認

```bash
# Extension Host のログ
# VSCode Output パネル → Extension Host を選択
```

## ローカルインストールでテスト

### 1. VSIXパッケージ作成

```bash
npm run package
```

### 2. インストール

```bash
# VSIXファイルを直接インストール
code --install-extension kioku-0.4.0.vsix
```

または VSCode UI で：
1. Extensions サイドバー
2. `...` メニュー → `Install from VSIX...`
3. `kioku-0.4.0.vsix` を選択

### 3. アンインストール

```bash
code --uninstall-extension Justhiro55.kioku
```

## トラブルシューティング

### コンパイルエラー
```bash
npm run compile
# エラーメッセージを確認
```

### 拡張が見つからない
```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### データが保存されない
- Developer Tools → Application → Storage でglobalStateを確認
- SQLiteの場合: `~/.vscode/globalStorage/Justhiro55.kioku/kioku.db`

### Webviewが表示されない
- Developer Tools でコンソールエラーを確認
- `kioku.useWebview` を `false` にして input mode で試す

## パフォーマンステスト

### 大量データ
1. 100枚以上のカードを作成
2. レビュー速度を確認
3. 検索速度を確認
4. SQLiteに移行して比較

### メモリ使用量
- Activity Monitor でメモリ確認
- 長時間使用してメモリリークチェック

## 自動テスト（将来実装）

```bash
npm test
```
