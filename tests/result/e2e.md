# E2E自動テスト結果

対象: [tests/e2e/run.mjs](../e2e/run.mjs)（Playwright、実`app.py`に対する実ブラウザ操作。AI非依存の定型操作のみ）

| 日時 | コマンド | 結果 |
|------|----------|------|
| 2026-09-09 | `docker run --rm -v "<repoルート>/tests/e2e:/app" -w /app -e BASE_URL=http://host.docker.internal:5000 node:24-slim sh -c "npm install && npx playwright install --with-deps chromium && npm test"` | 9件PASS、2件SKIP |

## SKIP内訳・既知バグ

以下は`PUT /sheet/{id}`のAPI契約不一致（BE側が`{title, body:{...}}`のネストを要求、design-document.md 8.2で確定した仕様は`{title, nodes, links, groups, notes}`のフラット構造）により保存が`400 bodyが必要です`で失敗するため、保存後続の項目をSKIP。修正タスクは[WBS.md](../../WBS.md)の「不具合修正・リグレッションテスト」参照。

- 保存・読込一覧反映・再読込
- シート削除（確認付き）

他のAPI契約不一致（`GET /sheet`, `GET /sheets`, `GET/PUT /state`, `GET /models`, `POST /ai`の`target_node_id`）はE2E実行経路外またはAI関連のため本結果には現れないが、WBS.mdに記録済み。
