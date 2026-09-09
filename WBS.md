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

- [x] `static/index.html`: CDN読み込み・マウント処理
- [x] 6章のカラーセット・レイアウトCSS実装
- [x] `AppRoot.js`: レイアウト組み立て
- [x] `ModeHud.js`: モード表示
- [x] `Toolbar.js`: 新規/読込/保存/エクスポート/インポート/Undo/Redo
- [x] `SheetTitle.js`: シートタイトルのインライン編集
- [x] `RadialWheel.js`: 汎用ラジアルメニュー

#### 各画面実装 (9/4 - 9/7 FE)

- [x] `useSheetState.js`: シート状態・CRUD
- [x] `usePhysicsSimulation.js`: 物理シミュレーション
- [x] `useUndoRedo.js`: Undo/Redo履歴
- [x] `useWheel.js`: ホイールの開閉・選択状態
- [x] `SheetCanvas.js`: パン・ズーム、モード別クリック操作
- [x] `SheetNode.js` / `SheetEdge.js` / `SheetGroup.js`: 描画
- [x] `EditPanel.js`: join/groupの簡易インライン編集パネル
- [x] `NotesPanel.js`: ノート一覧
- [x] `MutterInput.js`: ひとりごとメモ
- [x] `AiProposalPanel.js`: AI提案のコミット/却下
- [x] `ModelSelect.js`: モデル選択・システムプロンプト
- [x] `SheetListPanel.js`: シート一覧・新規作成

#### API連携実装 (9/7 - 9/8 PM/FE)

- [x] `useApiClient.js`: 各エンドポイント呼び出し実装
- [x] AI呼び出し前の自動保存（`PUT /sheet/{id}`）

### バックエンド (9/3 - 9/8 PM/BE)

#### コアビジネスロジック実装 (9/3 - 9/5 BE)

- [x] `database_service.py`: sheets/app_stateテーブル、シート本体ファイルI/O
- [x] `sheet_format_service.py`: 8.1.2パイプ区切り記法のシリアライズ・パース
- [x] `ai_service.py`: Ollamaモデル一覧取得・トランザクション提案生成

#### APIエンドポイント実装・単体テスト (9/5 - 9/8 PM/BE)

- [x] `GET /models`
- [x] `GET /sheets` / `POST /sheet`
- [x] `GET` / `PUT` / `DELETE` `/sheet/{id}`
- [x] `POST /ai`
- [x] `GET` / `PUT` `/state`
- [x] 共通エラー形式の実装・単体テスト

### 機能実装完了・コードフリーズ (9/8 PM/ALL)

- [x] フロントエンド・バックエンド成果物マージ

## テスト・QA (9/4 - 9/10)

### テストケース作成 (9/4 - 9/5 FE)

- [x] 自動テストケース
  - [x] 単体テスト
    - [x] フロントエンドテスト
    - [x] バックエンドテスト
  - [x] E2Eテスト
- [x] 手動テストケース
  - [x] シナリオテスト

### 結合テスト (9/8 - 9/9 PM/ALL)

- [x] 自動テスト実行

### システム・シナリオテスト (9/9 - 9/10 PM/ALL)

- [ ] シナリオテスト実行

### 不具合修正・リグレッションテスト (9/9 - 9/10 PM/FE/BE)

FE/BE  

- [x] APIリクエスト・レスポンスボディの統一（仕様書8.2に合わせる）
  - [x] BE: `PUT /sheet/{id}`: リクエストボディのフラット化（`body`ネスト廃止）
  - [x] BE: `GET /sheet/{id}`: レスポンスのフラット化（`body`ネスト廃止、作成・更新日時を含める）
  - [x] BE: `GET /sheets`: レスポンスのラップ解除（bare配列化）
  - [x] BE: `GET /state`: レスポンスのラップ解除（`state`キー廃止）
  - [x] BE: `PUT /state`: リクエストボディのラップ解除（`state`キー廃止）
  - [x] BE: `GET /models`: レスポンスを`{data:[{id}]}`形式に変更
  - [x] BE: `POST /ai`: `target_node_id`の空文字列判定バグ修正（`is None`判定に）
  - [x] FE: 上記API形式に呼び出し・レスポンス処理を合わせ、対応するフロントエンドテストを確認する
  - [x] BE: `GET /state`の値のJSON二重エンコードを解消する（`get_state()`に`json.loads()`を追加。FE変更不要）
  - [x] BE: AIノート生成モード（4.6・8.2`note`）が未実装
  - [x] BE: システムプロンプトの`L+`が`newId|nodeA|nodeB|comment`（4フィールド）で、design-document.md 8.1.2記載の`L+|a|b|comment`（3フィールド）と不一致
  - [x] BE: ひとりごとメモ（4.7）のAI連携が未実装。`/ai`が`text`を受け取らず、`ai_service`にも`mutter`モードの指示・プロンプトへの本文組込が無いため、ユーザーの入力がAIに渡らない
  - [x] BE: AI機能ごとにAIが生成する操作を制限（プロンプト・実行時フィルタ双方。mergeのDSLも`M|newId|id,id|text`に再設計）

FE  

- [x] `static/styles.css`のCSSクラスのクリーニング
  - [x] `.sheet-canvas`: 背景ドット重複定義
  - [x] `.app-header`: z-index重複定義
  - [x] `.sheet-header`: z-index重複定義
  - [x] `.sheet-title`: width重複定義
  - [x] `.sheet-toolbar`: margin-top重複定義
  - [x] `.toolbar-status`: min-height/margin-top重複定義
  - [x] `.canvas-hint`: left/bottom/font-size/white-spaceが3箇所で重複定義
- [x] モード操作関連
  - [x] マウスホイール操作時に、モードホイールが表示されない
  - [x] モードに対応するカーソル表示になっていない
  - [x] 右クリック長押し→モードホイール表示までの遅延をほぼ即時にする
  - [x] マウスホイール操作・右クリック長押しが競合した場合、後から開始した方へ即座に主導権を移すロジックを実装（design-document.md 4.1参照）
  - [x] モードホイールの文字要素の背景が透明でない
- [x] メインテーマノードが通常ノードと同じ大きさ（大きくする）
- [x] 背景のドットが移動しない
- [x] 画面全体のビネット効果が無い（CSSのみで実装可）
- [x] ヘッダ背景が透明でない
- [x] 右下AI設定項目内で要素が右詰めになっている（左詰めにする）
- [x] 左下ひとりごとメモ項目の横幅が狭い（大きめに取る）
- [x] ひとりごとメモ・システムプロンプトのカードの背景（透明にする。代わりにプレースホルダー文字を1段階濃くして強調）
- [x] 同グループ同士のノードはより引き合い、無所属を含む異なるグループ同士のノードは離れ合うようにする（`stepPhysics(bodies, edges, groups)`の第3引数として実装想定）
- [x] 引力と斥力の調整
- [x] ノード削除を子孫ごとの削除に変更（UI操作・AI提案`removes`の両方。design-document.md 4.1参照）
- [x] 削除を 600ms に修正
- [x] ノードID生成を`crypto.randomUUID()`から`n{連番}`形式の増分IDに変更
- [x] エッジのコメント表示・編集機能を実装（中点常時表示・インライン編集・必須化。design-document.md 4.1参照）
- [x] CSS:user-select で意図しないテキスト選択の防止
- [x] ショートカットホイールの各選択領域に背景を追加（未選択・ホバー・選択済みの3状態）
- [x] AIホイールの`value`（related/perspective/summary）がBEの`mode`名（expand/newview/note）と不一致
- [x] インタラクト可能な文字列に常時下線表示
- [x] UIラベルを全て英語表記に統一（テンプレート文言・aria-label・エラーメッセージ・index.html）

BE  

- [x] 定数ハードコードを、`python-dotenv` で `.env` から注入するよう変更
- [x] 組込のシステムプロンプト（`ai_service.py`の`_SYSTEM_BASE`/`_build_prompt`/モード別指示）テスト追加
- [x] LLM応答をストリーミングでサーバーコンソールに逐次出力するデバッグ機能追加
- [x] 各AIモードの応答フォーマット準拠を実機Ollamaで確認する診断スクリプト追加（`tests/ai_smoke/run.py`、複数回実行して失敗傾向をログ化）
- [x] `LLM_DEBUG_STREAM`のコンソール出力がWindows(cp932)で一部文字により例外落ちする不具合を修正
　　
### コードフリーズ (9/10 ALL)

---

> 今回、以降の作業項目は行わない。  

## リリース・移行 (9/11 - 9/14)

### リハーサル (9/11 Bob)

### 本番デモ資料作成 (9/14 Bob, John)

### 本番スモークテスト・稼働確認 (9/14 ALL)

### 振り返り・プロジェクトクローズ (9/14 ALL)
