# LLM連携サービス（design-document.md 8.2 API設計）。
# OpenAI SDKのクライアントを、ローカルのOllamaに向けて利用する。

from openai import OpenAI, APIConnectionError, APITimeoutError, APIStatusError

from services import sheet_format_service

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

# LLM推論のタイムアウト（秒）
LLM_TIMEOUT = 120

# AIモードの表示名マッピング
_MODE_LABELS = {
    'expand': '深掘り',
    'newview': '新視点',
    'link': '関連付け',
    'merge': 'ノード統合',
    'group': 'グループ化',
    'note': 'ノート生成',
}

# AIモードごとの指示
_MODE_INSTRUCTIONS = {
    'expand': '指定ノードに対して深掘りを行い、子ノードを3つ程度追加してください。',
    'newview': 'メインテーマに対して新たな視点を提案し、根直下のノードを2つ程度追加してください。',
    'link': '指定ノードと関連性の高い他のノードを1つ見つけ、間接エッジで接続してください。',
    'merge': '指定ノードと重複・類似の兄弟ノードを統合してください。',
    'group': '指定ノードとその子孫を意味的にまとめてグループ化してください。',
    'note': 'シート全体の要約をノートとして作成してください。',
}

# システムプロンプトの骨子
_SYSTEM_BASE = (
    'あなたはブレインストーミングを支援するAIです。'
    'ユーザーが提示するシート（ノード・エッジ・グループ・ノートの集合）に対して、'
    '指定された操作を行います。\n\n'
    '## 出力形式\n'
    '各操作は1行ずつパイプ区切りで出力してください。:\n'
    '- N+|newId|parentId|text — ノード追加（newIdはnew接頭辞のユニークID）\n'
    '- N-|id — ノード削除\n'
    '- N~|id|text — テキスト編集\n'
    '- L+|newId|nodeA|nodeB|comment — 間接エッジ追加\n'
    '- L-|id — 間接エッジ削除\n'
    '- G+|newId|memberIds(,区切り)|title|comment — グループ新規作成\n'
    '- M|id,id|text — ノード統合\n\n'
    'text/commentに|や改行が含まれる場合は使用しないでください。\n'
    '新規IDは「new1」「new2」のようにnew接頭辞で始めてください。\n'
    '余計な説明やコードブロック記号は出力せず、操作行のみを返してください。\n'
)


def _build_prompt(mode, serialized_sheet, target_node_id):
    """LLMへのプロンプトを組み立てる"""
    instruction = _MODE_INSTRUCTIONS.get(mode, '適切な提案を行ってください。')
    lines = [
        _SYSTEM_BASE,
        f'## 操作指示\n{instruction}',
        f'## 対象ノードID\n{target_node_id}',
        f'## シート\n```',
        serialized_sheet,
        '```',
    ]
    return '\n'.join(lines)


def _parse_link(line):
    """L+|newId|nodeA|nodeB|comment 形式からリンクオブジェクトを生成する"""
    parts = line.split('|')
    if len(parts) < 4:
        return None
    comment = sheet_format_service._unescape_field(parts[4]) if len(parts) > 4 else ''
    return {
        'id': parts[1],
        'a': parts[2],
        'b': parts[3],
        'comment': comment,
    }


def _parse_merge(line):
    """M|id,id|text 形式から統合オブジェクトを生成する"""
    parts = line.split('|')
    if len(parts) < 3:
        return None
    ids = parts[1].split(',')
    return {
        'ids': ids,
        'text': sheet_format_service._unescape_field(parts[2]),
    }


def _build_proposal(ops, ghosts, mode):
    """パース済みopsとghostsからフロントエンド向けトランザクション提案を組み立てる"""
    removes = []
    links = []
    group = None
    note = None
    merge = False

    for op_line in ops:
        op = op_line.split('|')[0]
        if op == 'N-':
            removes.append(op_line.split('|')[1])
        elif op == 'L+':
            link = _parse_link(op_line)
            if link:
                links.append(link)
        elif op == 'G+':
            parts = op_line.split('|')
            if len(parts) >= 4:
                members = parts[2].split(',')
                group = {
                    'id': parts[1],
                    'members': members,
                    'title': sheet_format_service._unescape_field(parts[3]),
                    'comment': sheet_format_service._unescape_field(parts[4]) if len(parts) > 4 else '',
                }
        elif op == 'M':
            merge = True

    return {
        'title': f'AI提案（{_MODE_LABELS.get(mode, mode)}）',
        'ops': ops,
        'ghosts': ghosts,
        'removes': removes,
        'links': links,
        'group': group,
        'note': note,
        'merge': merge,
    }


# ============================================================
# 公開API
# ============================================================

def list_models():
    """Ollamaで利用可能なモデル一覧を返す"""
    try:
        response = client.models.list()
        return [m.id for m in response.data]
    except APIConnectionError:
        raise LLMUnavailableError('Ollamaに接続できません')
    except APIStatusError:
        raise LLMUnavailableError('Ollamaのモデル一覧取得に失敗しました')


def request_transaction(model_name, mode, serialized_sheet, target_node_id, system_prompt):
    """LLMにトランザクションを提案させ、フロントエンド向けの提案形状に変換して返す"""
    prompt = _build_prompt(mode, serialized_sheet, target_node_id)
    messages = [
        {'role': 'system', 'content': system_prompt if system_prompt else prompt},
    ]
    if system_prompt:
        messages.append({'role': 'user', 'content': prompt})

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            timeout=LLM_TIMEOUT,
        )
    except APIConnectionError:
        raise LLMUnavailableError('Ollamaに接続できません')
    except APITimeoutError:
        raise LLMTimeoutError('LLM推論がタイムアウトしました')
    except APIStatusError as e:
        raise LLMUnavailableError(f'LLM呼び出しに失敗しました: {e.message}')

    content = response.choices[0].message.content or ''
    ops, ghosts = sheet_format_service.parse_llm_response(content)
    return _build_proposal(ops, ghosts, mode)


# ============================================================
# エクセプション
# ============================================================

class LLMUnavailableError(Exception):
    """Ollamaに接続できない場合のエクセプション（503）"""


class LLMTimeoutError(Exception):
    """LLM推論がタイムアウトした場合のエクセプション（504）"""
