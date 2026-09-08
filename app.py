# Flaskルーティング（design-document.md 8.2 API設計）。
# ビジネスロジックは services/ に委譲し、ここはルーティングのみに専念する（7.5参照）。

from flask import Flask, jsonify, request, send_from_directory

from services import ai_service, database_service, sheet_format_service

app = Flask(__name__)

# エラーレスポンスのステータスコード対応
_ERROR_STATUS = {
    'validation': 400,
    'not_found': 404,
    'llm_unavailable': 503,
    'llm_timeout': 504,
    'internal_error': 500,
}


def error_response(code, message):
    """共通エラー形式 {error: {code, message}} を返す"""
    status = _ERROR_STATUS.get(code, 500)
    return jsonify({'error': {'code': code, 'message': message}}), status


@app.route('/')
def index():
    # トップページ（static/index.html）を返す
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/models', methods=['GET'])
def get_models():
    try:
        models = ai_service.list_models()
    except ai_service.LLMUnavailableError as e:
        return error_response('llm_unavailable', str(e))
    return jsonify({'models': models})


@app.route('/sheets', methods=['GET'])
def get_sheets():
    return jsonify({'sheets': database_service.list_sheets()})


@app.route('/sheet', methods=['POST'])
def create_sheet():
    payload = request.get_json(silent=True) or {}
    title = payload.get('title', '無題')
    sheet_id = database_service.create_sheet(title)
    return jsonify({'id': sheet_id}), 201


@app.route('/sheet/<sheet_id>', methods=['GET'])
def get_sheet(sheet_id):
    sheet = database_service.get_sheet(sheet_id)
    if sheet is None:
        return error_response('not_found', '指定したシートが存在しません')
    database_service.update_state({'last_opened_sheet_id': sheet_id})
    return jsonify({'id': sheet['id'], 'title': sheet['title'], 'body': sheet['body']})


@app.route('/sheet/<sheet_id>', methods=['PUT'])
def update_sheet(sheet_id):
    payload = request.get_json(silent=True) or {}
    title = payload.get('title', '無題')
    body = payload.get('body')
    if body is None:
        return error_response('validation', 'bodyが必要です')
    updated = database_service.update_sheet(sheet_id, title, body)
    if not updated:
        return error_response('not_found', '指定したシートが存在しません')
    return jsonify({'ok': True})


@app.route('/sheet/<sheet_id>', methods=['DELETE'])
def delete_sheet(sheet_id):
    deleted = database_service.delete_sheet(sheet_id)
    if not deleted:
        return error_response('not_found', '指定したシートが存在しません')
    return jsonify({'ok': True})


@app.route('/ai', methods=['POST'])
def request_ai():
    payload = request.get_json(silent=True) or {}
    model_name = payload.get('model_name')
    mode = payload.get('mode')
    sheet_id = payload.get('sheet_id')
    target_node_id = payload.get('target_node_id')
    system_prompt = payload.get('system_prompt', '')

    if not model_name or not mode or not sheet_id or not target_node_id:
        return error_response('validation', 'model_name, mode, sheet_id, target_node_idが必要です')

    sheet = database_service.get_sheet(sheet_id)
    if sheet is None:
        return error_response('not_found', '指定したシートが存在しません')

    serialized = sheet_format_service.serialize_for_llm(sheet['body'])
    try:
        proposal = ai_service.request_transaction(
            model_name,
            mode,
            serialized,
            target_node_id,
            system_prompt,
        )
    except ai_service.LLMUnavailableError as e:
        return error_response('llm_unavailable', str(e))
    except ai_service.LLMTimeoutError as e:
        return error_response('llm_timeout', str(e))

    return jsonify(proposal)


@app.route('/state', methods=['GET'])
def get_state():
    return jsonify({'state': database_service.get_state()})


@app.route('/state', methods=['PUT'])
def update_state():
    payload = request.get_json(silent=True) or {}
    partial = payload.get('state')
    if partial is None or not isinstance(partial, dict):
        return error_response('validation', 'stateオブジェクトが必要です')
    database_service.update_state(partial)
    return jsonify({'ok': True})


@app.errorhandler(Exception)
def handle_internal_error(e):
    return error_response('internal_error', '予期しないエラーが発生しました')


if __name__ == '__main__':
    database_service.init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
