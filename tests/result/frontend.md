# フロントエンド自動テスト結果

対象: [tests/frontend/run.mjs](../frontend/run.mjs)（jsdom、API応答はモック）

| 日時 | コマンド | 結果 |
|------|----------|------|
| 2026-09-09 | `docker run --rm -v "<repoルート>:/app" -w /app/tests/frontend node:24-slim sh -c "npm install && npm test"` | 16件PASS |
| 2026-09-09 | 同上 | 17件PASS（API応答不正・ネットワーク障害・不正インポートのエラーハンドリングを追加） |
