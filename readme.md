# AIサポート付きブレストアプリ

# 概要

AIのサポート機能がついたブレインストーミングのシート管理アプリです。仕様の詳細は [design-document.md](design-document.md) を参照してください。

- フロントエンド: Vue.js（CDN版、ビルドツールなし）
- バックエンド: Python, Flask, OpenAI SDK経由でローカルのOllamaを利用
- DB: sqlite

# 環境
- Vscode
- OpenCode
- ollama

# 開発ツールインストール

- 管理者権限でコマンドプロンプトを起動します。

- 以下のコマンドを実行し、必要なソフトウェアを入手します。

```
winget install --id Microsoft.VisualStudioCode -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id Python.Python.3.13 -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id SST.opencode -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id Ollama.Ollama -e --source winget --accept-package-agreements --accept-source-agreements
start /b ollama serve > NUL 2>&1
timeout /t 3 /nobreak > NUL
ollama pull qwen2.5-coder:0.5b
```

- vscodeを起動し、アクティビティバーの拡張機能から、以下のプラグインをインストールしてください。
  - Python
  - Vue.js Extension Pack

# 環境セットアップ

- Python 仮想環境構築

  > Windows PowerShell 上で作業します。  

  以下のコマンドでPythonの仮想環境を構築します。  

  ```
  python -m venv .venv
  ```

  > `/.venv` ディレクトリが作成されます。  
  > `.gitignore` によって `/.venv` ディレクトリはGit管理から外されています。  

  以下のコマンドで仮想環境をアクティベートします。  

  ```
  .\.venv\Scripts\activate
  ```

  > 成功すると、ターミナルに `(.venv)` と表示されます。  
  > 以降、Python や pip などを実行する際は仮想環境内で実行してください。  

  仮想環境を終了する場合は、以下のコマンドを使うか、ターミナルを終了します。  

  ```
  deactivate
  ```

  > コマンドの実行が成功すると、 `(.venv)` の表示が消えます。  

- Python ライブラリインストール

  以下のコマンドでPythonの利用ライブラリをインストールします。

  ```
  pip install -r requirements.txt
  ```

# 実行方法

- 以下のコマンドでサーバを起動します。

  ```
  python app.py
  ```

- ブラウザで以下のURLにアクセスしてみてください。

  ```
  http://localhost:5000
  ```

# 開発の参考資料

## ローカルの Ollama を使う場合

- VsCode上でターミナルを開いて、以下を入力します。
```
ollama launch opencode --model=qwen2.5-coder:0.5b
```

> 本アプリは初期リリースではローカルモデルのみに対応します（design-document.md 2章参照）。クラウドモデルの利用は将来拡張です。

# AIを用いたコード修正

- opencodeに修正を依頼してみてください。（例：ノードの色を変更する機能を追加して）
- フロントエンド/バックエンドの担当分担・変更範囲は [AGENTS.md](AGENTS.md) を参照してください。

# 参考リンク

- [Flask](https://flask.palletsprojects.com/en/stable/)

  - Python で書かれた Webアプリケーションサーバ

- [Vue.js](https://vuejs.org/)

  - JavaScript製のWebフロントエンド フレームワーク

- [Vue.js Tutorial](https://ja.vuejs.org/tutorial/)

  - Vue.jsの入門用チュートリアル

- [OpenAI API](https://github.com/openai/openai-python)

  - Pythonから、OpenAI APIを呼び出すライブラリ

- [Feather Icons](https://github.com/feathericons/feather)

  - UIのアイコン表示に用いるアイコンライブラリ
