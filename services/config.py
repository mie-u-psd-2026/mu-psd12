# バックエンドの実行設定を.envと環境変数から読み込む。
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env', override=False)

# Flaskサーバーの待受アドレス。
FLASK_HOST = os.environ.get('FLASK_HOST', '0.0.0.0')
# Flaskサーバーの待受ポート。
FLASK_PORT = int(os.environ.get('FLASK_PORT', '5000'))
# Flaskのデバッグ設定。
FLASK_DEBUG = os.environ.get('FLASK_DEBUG', 'true').lower() in ('true', '1', 'yes', 'on')
# シートとデータベースの保存先。
STORAGE_DIR = os.environ.get('STORAGE_DIR', '/storage')
# OllamaのOpenAI互換API接続先。
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434/v1')
# OllamaのAPIキー。
OLLAMA_API_KEY = os.environ.get('OLLAMA_API_KEY', 'ollama')
# LLM推論のタイムアウト秒数。
LLM_TIMEOUT = float(os.environ.get('LLM_TIMEOUT', '120'))
