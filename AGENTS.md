# AGENTS.md

このリポジトリでの作業ルール。セットアップ・実行方法は [readme.md](readme.md)、仕様・コーディング規約は [design-document.md](design-document.md) を参照する（本ファイルで重複させない）。

## 共通ルール

- 担当領域外のファイルは変更しない
- コーディング規約は design-document.md 7章に従う

## フロントエンド担当

- 担当: `static/`, `mocks/`
- 上記以外（`app.py` 等）は変更しない
- `frontend` ブランチ上で作業する

## バックエンド担当

- 担当: `app.py`, `requirements.txt`, `services/`（新設時）
- `static/`, `mocks/` は変更しない
- `backend` ブランチ上で作業する

## ブランチ運用

- 不必要なブランチ切りはしない（`frontend`/`backend`/`develop` 以外の作業ブランチを増やさない）
- `pm` ブランチはPM専用。基本使用しない
- `develop` ブランチは各作業ブランチのマージ用
  - 各作業ブランチの変更は `develop` へ順にマージ・コンフリクト解決し、他の作業ブランチへ反映する
- `develop` に変更があった場合は、作業開始前に自身の作業ブランチへマージする
- 作業終了後、必要に応じて `develop` へのマージを行う