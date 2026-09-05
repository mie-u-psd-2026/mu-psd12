# ============================================================
# プレースホルダーファイル。
# 実装時には、このコメントを含む全てのプレースホルダーコメントを削除すること。
# ============================================================
#
# シートのフォーマット変換サービス（design-document.md 8.1.1 データスキーマ / 8.1.2 LLM入出力）。
# シートのシリアライズ・LLM応答のパースをここに集約する。


def serialize_for_llm(body):
    # TODO: 8.1.2 — 内部保存形式（8.1.1）のnodes/links/groups/notesを
    #       N|/L|/G|/T| のパイプ区切り記法（行指向）に変換する
    pass


def parse_llm_response(text):
    # TODO: 8.1.2 — LLM応答（N+/N-/N~/L+/L-/G+/M の行）を1行ずつパースする
    #       壊れた行は例外を投げず読み飛ばし、4.3のトランザクション提案形状に変換する
    pass


def to_export_format(body, metadata):
    # TODO: 8.1.1 エクスポート形式 — 本体に metadata（title, created_at, updated_at）を同梱する
    pass


def from_import_format(payload):
    # TODO: 8.1.1 — インポートされたファイルから本体を取り出す（常に新規シートとして扱う）
    pass
