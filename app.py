# ============================================================
# プレースホルダーファイル。
# 実装時には、このコメントを含む全てのプレースホルダーコメントを削除すること。
# ============================================================
#
# Flaskルーティング（design-document.md 8.2 API設計）。
# ビジネスロジックは services/ に委譲し、ここはルーティングのみに専念する（7.5参照）。

from flask import Flask, request, jsonify, send_from_directory

# from services import database_service, ai_service, sheet_format_service

app = Flask(__name__)


@app.route('/')
def index():
    # トップページ（static/index.html）を返す
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/models', methods=['GET'])
def get_models():
    # TODO: GET /models — 利用可能なモデル一覧を返す（ai_service.list_models）
    pass


@app.route('/sheets', methods=['GET'])
def get_sheets():
    # TODO: GET /sheets — シート一覧 {id, title, updated_at} を返す（database_service.list_sheets）
    pass


@app.route('/sheet', methods=['POST'])
def create_sheet():
    # TODO: POST /sheet — 新規シートを作成しIDを払い出す（database_service.create_sheet）
    pass


@app.route('/sheet/<sheet_id>', methods=['GET'])
def get_sheet(sheet_id):
    # TODO: GET /sheet/{id} — シートを読み込む。app_state.last_opened_sheet_id を更新する
    pass


@app.route('/sheet/<sheet_id>', methods=['PUT'])
def update_sheet(sheet_id):
    # TODO: PUT /sheet/{id} — シートを保存する（database_service.update_sheet）
    pass


@app.route('/sheet/<sheet_id>', methods=['DELETE'])
def delete_sheet(sheet_id):
    # TODO: DELETE /sheet/{id} — シートを削除する（初期実装では物理削除）
    pass


@app.route('/ai', methods=['POST'])
def request_ai():
    # TODO: POST /ai — 指定シートに対してAIにトランザクションの提案を行わせる
    # req: {model_name, mode, sheet_id, target_node_id}
    # 呼び出し前提: フロントが直前に PUT /sheet/{id} で自動保存済みであること
    # 成功時(200): {title, ops, ghosts, removes, links, group, note, merge}（4.3参照）
    # 失敗時: 共通エラー形式 {error: {code, message}}（validation/not_found/llm_unavailable/llm_timeout/internal_error）
    pass


@app.route('/state', methods=['GET'])
def get_state():
    # TODO: GET /state — app_state の全キーの値をまとめて返す
    pass


@app.route('/state', methods=['PUT'])
def update_state():
    # TODO: PUT /state — 渡されたキーのみ部分更新する（マージ更新）
    pass


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
