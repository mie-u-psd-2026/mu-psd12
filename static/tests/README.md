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
