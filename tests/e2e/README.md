# E2E自動テスト（Playwright）

AIの絡まない定式操作（シート編集・履歴・保存/読込・エクスポート/インポート等）を、実ブラウザ（Chromium）から実際に起動中の`app.py`へ操作して検証する。
AIモード（`/ai`呼び出し）を伴う手順は対象外（test-spec.md 5章「実Ollama接続確認」で別途手動確認する）。

## 前提

- `app.py`が起動していること（`.venv`を有効化し、`python app.py`）
- テスト用に`STORAGE_DIR`を別ディレクトリに向けて起動すること推奨（本番の`/storage`を汚さないため）

## 実行方法（Dockerの一時コンテナ、`node`イメージを使用）

```
docker run --rm -v "<repoルート>/tests/e2e:/app" -w /app node:24-slim sh -c \
  "npx -y playwright@1.48.0 install --with-deps chromium && npm install && BASE_URL=http://host.docker.internal:5000 npm test"
```

`BASE_URL`未指定時は`http://localhost:5000`を使う（コンテナを使わずホストで直接実行する場合）。
