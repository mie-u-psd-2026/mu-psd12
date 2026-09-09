# バックエンド自動テスト結果

対象: [tests/backend/test_backend.py](../backend/test_backend.py)

| 日時 | コマンド | 結果 |
|------|----------|------|
| 2026-09-08 | `python -m unittest tests.backend.test_backend` | 16 tests, OK（全PASS） |
| 2026-09-09 | `python -m unittest tests.backend.test_backend` | 21 tests, OK（全PASS。`POST /ai`成功/504/400、`DELETE`404、内部エラー500の異常系5件を追加） |
| 2026-09-09 | `python -m unittest tests.backend.test_backend` | 25 tests, **6件FAILED**（意図的なred状態。API契約統一（WBS.md「APIリクエストボディの統一」）に合わせた新規/更新テストで、BE実装が追いつくまで失敗し続ける想定） |
| 2026-09-09 | `python -m unittest tests.backend.test_backend` | BEのAPIフラット化7項目実装後、25 tests中23 PASS。API契約系4件はPASSに転じたが、`test_state_api`/`test_state_merge`が新たにFAIL（`get_state()`の`json.loads`欠落による二重エンコードを正しく期待値に反映したため。原因調査は下記参照） |
