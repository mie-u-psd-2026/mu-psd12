# API契約のフロント側検証

WBS 120〜130行の範囲だけを、実際のフロント処理と模擬HTTPで検証します。バックエンドや保存データは変更しません。

既存の `tests/frontend` の依存パッケージ（Vue、jsdom）を利用し、リポジトリルートから実行します。

```sh
node --loader ./tests/frontend/loader.mjs ./static/tests/api_contract.mjs
```

別の場所にインストール済みの依存パッケージを使う場合:

```sh
UI_TEST_MODULES=/path/to/dependencies node --loader ./tests/frontend/loader.mjs ./static/tests/api_contract.mjs
```

対象: シート・設定のフラット形式、シート一覧の配列、モデルの `{data:[{id}]}`、AI全体対象の空文字列、AI前保存と保存失敗時の中止、不正対象ID・旧API形式のエラー処理。

実バックエンドとの結合確認およびWBS 133行以降のUI修正は対象外です。

## UI・物理計算の回帰検証（WBS 135〜163行）

```sh
node --loader ./tests/frontend/loader.mjs ./static/tests/ui_regression.mjs
```

上記と同じ `UI_TEST_MODULES` 指定も利用できます。

既存の `tests/frontend/run.mjs` は変更せず読み込みます。実行時に、旧AI削除の期待値（子を親へつなぎ直す）を子孫削除へ合わせ、既存テストのアンマウント後に行われるUI検証のためにアプリを再マウントします。元テストの修正時にはこの補正も見直してください。

追加検証は、増分ID・AI親子参照・削除対象の親子重複・関連参照の除去・入力競合・タイマー取消・テーマサイズ・パン/ズーム時の背景追従・ドラッグカーソル・背景透過です。実ブラウザでの見た目や操作感、実バックエンドとの結合は別途確認が必要です。
