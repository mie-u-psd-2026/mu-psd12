# フロントエンド検証

```sh
cd tests/frontend
npm install
npm test
```

Dockerの一時コンテナ（`node`イメージ）で実行する場合は、`static/`への相対importが解決できるようリポジトリルートごとマウントする。

```sh
docker run --rm -v "<repoルート>:/app" -w /app/tests/frontend node:24-slim sh -c "npm install && npm test"
```

ブラウザ用のVueと同じバージョンをjsdomで使用します。本番のビルド処理はありません。
実バックエンドは変更せず、HTTP応答をテスト内で模擬します。画面の見た目やOllama推論は別途実ブラウザで確認してください。
