# Work Brakedown Structure

- PM: 宮脇 424854
- FE: 有働 424807
- BE: 文平 424844

## 要件定義・基本設計 (着手日: 9/1 - 9/2 作業者: PM/ALL)

- [x] 役割分担
- [ ] [仕様書](design-document.md) の作成

### 要求整理・スコープ定義 (9/1 PM)

- [x] 要求整理
- [x] スコープ定義
- [ ] 要件定義
  - [x] 機能
  - [x] 技術スタック
  - [ ] 使用例

> 9/5時点: 使用例のみ未完了

### 画面ワイヤーフレーム作成 (9/1 - 9/2 PM/ALL)

- [x] ワイヤーフレーム・モックの作成（[mocks/index.html](mocks/index.html)）
  - [x] 画面設計
  - [x] デザインガイドライン設計

### APIスキーマ策定 (9/1 - 9/2 PM)

- [x] スキーマ策定
  - [x] データスキーマ
  - [x] APIスキーマ

### 仕様FIX (9/2 PM/ALL)

> 9/5時点: 使用例を除きFIX

## 詳細設計・実装 (9/3 - 9/8)

> 9/5時点: フロントエンド・バックエンドともにファイル構成の雛形（プレースホルダー）を作成済み（[AGENTS.md](AGENTS.md)参照）。実装はこれから

### フロントエンド (9/3 - 9/8 PM/FE)

#### 共通UI・レイアウト作成 (9/3 - 9/4 FE)

- [ ] `static/index.html`: CDN読み込み・マウント処理
- [ ] 6章のカラーセット・レイアウトCSS実装
- [ ] `AppRoot.js`: レイアウト組み立て
- [ ] `ModeHud.js`: モード表示
- [ ] `Toolbar.js`: 新規/読込/保存/エクスポート/インポート/Undo/Redo
- [ ] `SheetTitle.js`: シートタイトルのインライン編集
- [ ] `RadialWheel.js`: 汎用ラジアルメニュー

#### 各画面実装 (9/4 - 9/7 FE)

- [ ] `useSheetState.js`: シート状態・CRUD
- [ ] `usePhysicsSimulation.js`: 物理シミュレーション
- [ ] `useUndoRedo.js`: Undo/Redo履歴
- [ ] `useWheel.js`: ホイールの開閉・選択状態
- [ ] `SheetCanvas.js`: パン・ズーム、モード別クリック操作
- [ ] `SheetNode.js` / `SheetEdge.js` / `SheetGroup.js`: 描画
- [ ] `EditPanel.js`: join/groupの簡易インライン編集パネル
- [ ] `NotesPanel.js`: ノート一覧
- [ ] `MutterInput.js`: ひとりごとメモ
- [ ] `AiProposalPanel.js`: AI提案のコミット/却下
- [ ] `ModelSelect.js`: モデル選択・システムプロンプト
- [ ] `SheetListPanel.js`: シート一覧・新規作成

#### API連携実装 (9/7 - 9/8 PM/FE)

- [ ] `useApiClient.js`: 各エンドポイント呼び出し実装
- [ ] AI呼び出し前の自動保存（`PUT /sheet/{id}`）

### バックエンド (9/3 - 9/8 PM/BE)

#### コアビジネスロジック実装 (9/3 - 9/5 BE)

- [ ] `database_service.py`: sheets/app_stateテーブル、シート本体ファイルI/O
- [ ] `sheet_format_service.py`: 8.1.2パイプ区切り記法のシリアライズ・パース
- [ ] `ai_service.py`: Ollamaモデル一覧取得・トランザクション提案生成

#### APIエンドポイント実装・単体テスト (9/5 - 9/8 PM/BE)

- [ ] `GET /models`
- [ ] `GET /sheets` / `POST /sheet`
- [ ] `GET` / `PUT` / `DELETE` `/sheet/{id}`
- [ ] `POST /ai`
- [ ] `GET` / `PUT` `/state`
- [ ] 共通エラー形式の実装・単体テスト

### 機能実装完了・コードフリーズ (9/8 PM/ALL)

## テスト・QA (9/4 - 9/10)

### テストケース作成 (9/4 - 9/5 FE)

### 結合テスト (9/8 - 9/9 PM/ALL)

### システム・シナリオテスト (9/9 - 9/10 PM/ALL)

### 不具合修正・リグレッションテスト (9/9 - 9/10 PM/ALL)

### コードフリーズ (9/10 ALL)

---

## リリース・移行 (9/11 - 9/14)

### リハーサル (9/11 Bob)

### 本番デモ資料作成 (9/14 Bob, John)

### 本番スモークテスト・稼働確認 (9/14 ALL)

### 振り返り・プロジェクトクローズ (9/14 ALL)
