# ============================================================
# プレースホルダーファイル。
# 実装時には、このコメントを含む全てのプレースホルダーコメントを削除すること。
# ============================================================
#
# LLM連携サービス（design-document.md 8.2 API設計）。
# OpenAI SDKのクライアントを、ローカルのOllamaに向けて利用する。

from openai import OpenAI

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")


def list_models():
    # TODO: GET /models 用 — client.models.list() 経由でOllamaのモデル一覧を取得する
    pass


def request_transaction(model_name, mode, serialized_sheet, target_node_id, system_prompt):
    # TODO: POST /ai 用 — sheet_format_service でシリアライズ済みのシート（8.1.2）を
    #       プロンプトに含め、LLMにトランザクション（N+/N-/N~/L+/L-/G+/M）を提案させる
    # 応答は sheet_format_service.parse_llm_response でパースし、
    # 4.3のトランザクション提案形状 {title, ops, ghosts, removes, links, group, note, merge} に変換する
    # 接続失敗時は llm_unavailable、タイムアウト時は llm_timeout として呼び出し元に伝える（8.2）
    pass
