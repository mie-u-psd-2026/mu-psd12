# シートのフォーマット変換サービス（design-document.md 8.1.1 データスキーマ / 8.1.2 LLM入出力）。
# シートのシリアライズ・LLM応答のパースをここに集約する。

# パイプ区切り記法のフィールド区切り文字
_SEP = '|'


# LLMが使用する安全な置換マッピング（text/comment内の|と改行を退避）
_ESCAPED_PIPE = '\x00'
_ESCAPED_NEWLINE = '\x01'

_ESCAPE_TABLE = [
    ('|', _ESCAPED_PIPE),
    ('\n', _ESCAPED_NEWLINE),
    ('\r', _ESCAPED_NEWLINE),
]

_UNESCAPE_TABLE = [
    (_ESCAPED_PIPE, '|'),
    (_ESCAPED_NEWLINE, '\n'),
]


def _escape_field(value):
    """フィールド値の|や改行をLLM安全な文字に置換する"""
    result = value
    for old, new in _ESCAPE_TABLE:
        result = result.replace(old, new)
    return result


def _unescape_field(value):
    """LLM応答内の退避文字を元の文字に戻す"""
    result = value
    for old, new in _UNESCAPE_TABLE:
        result = result.replace(old, new)
    return result


# ============================================================
# シリアライズ（8.1.2 パイプ区切り記法への変換）
# ============================================================

def serialize_for_llm(body):
    """内部保存形式のbodyをLLM向けパイプ区切り記法に変換する"""
    lines = []
    for node in body['nodes']:
        parent_id = node['parent'] if node['parent'] else '-'
        lines.append(f"N{_SEP}{node['id']}{_SEP}{parent_id}{_SEP}{_escape_field(node['text'])}")
    for link in body['links']:
        lines.append(f"L{_SEP}{link['id']}{_SEP}{link['a']}{_SEP}{link['b']}{_SEP}{_escape_field(link['comment'])}")
    for group in body['groups']:
        member_ids = ','.join(group['members'])
        lines.append(f"G{_SEP}{group['id']}{_SEP}{member_ids}{_SEP}{_escape_field(group['title'])}{_SEP}{_escape_field(group['comment'])}")
    for note in body['notes']:
        lines.append(f"T{_SEP}{_escape_field(note['title'])}{_SEP}{_escape_field(note['body'])}")
    return '\n'.join(lines)


# ============================================================
# LLM応答パース（8.1.2 操作プレフィックス付き行の解釈）
# ============================================================

def parse_node_parents(serialized_sheet):
    """シリアライズ済みシートからid→親IDの対応表を返す（Mのマージ処理で使用）。"""
    parents = {}
    for raw_line in serialized_sheet.strip().split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        parts = line.split(_SEP)
        if parts[0] == 'N' and len(parts) >= 3:
            parents[parts[1]] = parts[2] if parts[2] != '-' else None
    return parents


def parse_llm_response(text):
    """LLM応答行をパースし、操作配列（行文字列リスト）とゴーストノード配列を返す。

    Returns:
        tuple: (ops: list[str], ghosts: list[dict])
    """
    ops = []
    ghosts = []
    for raw_line in text.strip().split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        parts = line.split(_SEP)
        op = parts[0]
        if op == 'N+' and len(parts) >= 4:
            ops.append(line)
            ghosts.append({
                'id': parts[1],
                'kind': 'idea',
                'text': _unescape_field(parts[3]),
                'parent': parts[2] if parts[2] != '-' else None,
            })
        elif op in ('N-', 'N~', 'L+', 'L-', 'G+', 'M', 'T+') and len(parts) >= 2:
            ops.append(line)
        # 壊れた行は例外を投げず読み飛ばす
    return ops, ghosts


# ============================================================
# エクスポート/インポート（8.1.1）
# ============================================================

def to_export_format(body, metadata):
    """本体に metadata を同梱した自己完結形式に変換する"""
    return {**body, 'metadata': metadata}


def from_import_format(payload):
    """インポートファイルからメタデータと本体を取り出す。
    インポートは常に新規シートとして扱う（メタデータは参照のみで本体に含めない）。
    """
    metadata = payload.get('metadata', {})
    body = {
        'nodes': payload.get('nodes', []),
        'links': payload.get('links', []),
        'groups': payload.get('groups', []),
        'notes': payload.get('notes', []),
    }
    return body, metadata
