# フロントエンド検証

```sh
cd static/tests
npm install
npm test
```

ブラウザ用のVueと同じバージョンをjsdomで使用します。本番のビルド処理はありません。
実バックエンドは変更せず、HTTP応答をテスト内で模擬します。画面の見た目やOllama推論は別途実ブラウザで確認してください。
