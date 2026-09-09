# LLM連携サービス（design-document.md 8.2 API設計）。
# OpenAI SDKのクライアントを、ローカルのOllamaに向けて利用する。

import sys

from openai import OpenAI, APIConnectionError, APITimeoutError, APIStatusError

from services import config, sheet_format_service

client = OpenAI(base_url=config.OLLAMA_BASE_URL, api_key=config.OLLAMA_API_KEY)

# LLM推論のタイムアウト（秒）
LLM_TIMEOUT = config.LLM_TIMEOUT

# AIモードの表示名マッピング
_MODE_LABELS = {
    'expand': '深掘り',
    'newview': '新視点',
    'link': '関連付け',
    'merge': 'ノード統合',
    'group': 'グループ化',
    'note': 'ノート生成',
    'mutter': 'ひとりごと反映',
}

# AIモードごとの指示。出力すべき操作プレフィックスを指示文自体にも重ねて明記し、
# 「モードに関わらずN+で応答する」という既定挙動への引き戻しを防ぐ。
_MODE_INSTRUCTIONS = {
    'expand': '指定ノードに対して深掘りを行い、子ノードを3つ程度追加してください。'
              '出力は`N+`のみを使用してください。',
    'newview': 'メインテーマに対して新たな視点を提案し、根直下のノードを2つ程度追加してください。'
               '出力は`N+`のみを使用してください。',
    'link': '指定ノードと関連性の高い他のノードを1つ見つけ、間接エッジで接続してください。'
            '出力は`L+`のみを使用し、指定ノードと関連ノードの両方のIDを指定してください。'
            '`N+`は使用禁止です（新しいノードを追加するモードではありません）。',
    'merge': '指定ノードと重複・類似の兄弟ノードを統合してください。'
             '出力は`M`のみを使用し、統合対象には指定ノード自身のIDも含め、2つ以上の兄弟ノードIDを`,`区切りで指定してください'
             '（新規ノードの追加ではない）。',
    'group': '指定ノードとその子孫を意味的にまとめてグループ化してください。'
             '出力は`G+`のみを使用してください。'
             '他の種類の操作は出力しないでください。',
    'note': 'シート全体の要約をノートとして作成してください。'
            '出力は`T+`のみを使用してください。'
            '他の種類の操作は出力しないでください。',
    'mutter': 'ユーザーの入力（ひとりごと）を読み取り、シートに新しいノードやノートとして反映する提案をしてください。',
}

# 各操作の説明文（モードごとの許可リストでフィルタして提示する）。プレフィックスの
# 綴りと記号の順序を誤りやすいため、抽象的な書式に加え具体的な出力例も示す。
_OP_DESCRIPTIONS = {
    'N+': 'N+|newId|parentId|text — ノード追加（newIdはnew接頭辞のユニークID。例: N+|new1|n0|新しい案）',
    'N-': 'N-|id — ノード削除',
    'N~': 'N~|id|text — テキスト編集',
    'L+': 'L+|newId|nodeA|nodeB|comment — 間接エッジ追加（例: L+|new1|n2|n5|関連性が高い）',
    'L-': 'L-|id — 間接エッジ削除',
    'G+': 'G+|newId|memberIds(,区切り)|title|comment — グループ新規作成（例: G+|new1|n2,n3|新デザイン案|検討中）',
    'M': 'M|newId|id,id|text — ノード統合（統合元は指定ノード自身を含む2つ以上の兄弟ノード。親は自動判定。例: M|new1|n4,n5|抹茶風味の新商品）',
    'T+': 'T+|newId|title|body — ノート作成（例: T+|new1|要約|本文）',
}

# AIモードごとに許可する操作（未定義のモードは全操作を許可）。
_MODE_ALLOWED_OPS = {
    'expand': ('N+',),
    'newview': ('N+',),
    'link': ('L+',),
    'merge': ('M',),
    'group': ('G+',),
    'note': ('T+',),
    'mutter': tuple(_OP_DESCRIPTIONS),
}

# システムプロンプトの前後の固定文言。
_SYSTEM_INTRO = (
    'あなたはブレインストーミングを支援するAIです。'
    'ユーザーが提示するシート（ノード・エッジ・グループ・ノートの集合）に対して、'
    '指定された操作を行います。\n\n'
    '## 出力形式（あなたが出力する操作行の書式。後述する「## シート」の表示形式とは異なるので注意）\n'
    '各操作は1行ずつパイプ区切りで出力してください。操作プレフィックス（+や~を含む記号）は省略しないこと。:\n'
)
_SYSTEM_OUTRO = (
    'text/commentに|や改行が含まれる場合は使用しないでください。\n'
    '新規IDは「new1」「new2」のようにnew接頭辞で始めてください。\n'
    '余計な説明やコードブロック記号（```等）は出力せず、操作行のみを返してください。\n'
    '記号の順序を正確に守ってください（例: `N+`が正しく、`+N`のように順序を入れ替えないこと）。\n'
    '上記で許可されていない操作（例: 許可されていないのにノードを追加する等）は行わないでください。\n'
)


def _build_system_base(mode):
    """モードで許可された操作だけを出力形式として提示するシステムプロンプトを組み立てる"""
    allowed = _MODE_ALLOWED_OPS.get(mode, tuple(_OP_DESCRIPTIONS))
    bullets = ''.join(f'- {_OP_DESCRIPTIONS[op]}\n' for op in _OP_DESCRIPTIONS if op in allowed)
    return _SYSTEM_INTRO + bullets + '\n' + _SYSTEM_OUTRO


def _build_prompt(mode, serialized_sheet, target_node_id, text=''):
    """LLMへのプロンプトを組み立てる"""
    instruction = _MODE_INSTRUCTIONS.get(mode, '適切な提案を行ってください。')
    lines = [
        _build_system_base(mode),
        f'## 操作指示\n{instruction}',
        f'## 対象ノードID\n{target_node_id}',
        f'## シート（現在の状態を表示用の形式で示す。この形式のまま出力しないこと）\n```',
        serialized_sheet,
        '```',
    ]
    if text:
        lines.append(f'## ユーザーの入力\n{text}')
    lines.append(
        '## 出力\n'
        '上記「## シート」の表示形式（例: N|id|parentId|text、操作プレフィックスなし）と、'
        'あなたが出力すべき操作形式（例: N+|newId|parentId|text、+等のプレフィックスを含む）は異なります。\n'
        '許可された操作行のみを、プレフィックスを省略せずに出力してください。'
    )
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


def _parse_note(line):
    """T+|newId|title|body 形式からノートオブジェクトを生成する"""
    parts = line.split('|')
    if len(parts) < 4:
        return None
    return {
        'id': parts[1],
        'title': sheet_format_service._unescape_field(parts[2]),
        'body': sheet_format_service._unescape_field(parts[3]),
    }


def _parse_merge(line, node_parents):
    """M|newId|id,id|text 形式から統合オブジェクトを生成する。

    統合元は共通の親を持つ兄弟ノードである必要があり、統合後ノードの親として自動採用する。
    親が食い違う、またはIDが不明な場合はNoneを返す（不正行として読み飛ばす）。
    """
    parts = line.split('|')
    if len(parts) < 4:
        return None
    new_id = parts[1]
    ids = [id_ for id_ in parts[2].split(',') if id_]
    if len(ids) < 2 or any(id_ not in node_parents for id_ in ids):
        return None
    parents = {node_parents[id_] for id_ in ids}
    if len(parents) != 1:
        return None
    return {
        'id': new_id,
        'parent': parents.pop(),
        'text': sheet_format_service._unescape_field(parts[3]),
        'sources': ids,
    }


def _build_proposal(ops, ghosts, mode, node_parents):
    """パース済みopsとghostsからフロントエンド向けトランザクション提案を組み立てる。

    モードで許可されていない操作は除外する（LLM_DEBUG_STREAM有効時は除外をログ出力）。
    """
    allowed = _MODE_ALLOWED_OPS.get(mode, tuple(_OP_DESCRIPTIONS))
    removes = []
    links = []
    group = None
    note = None
    merge = False
    ghosts = list(ghosts)
    kept_ops = []

    for op_line in ops:
        op = op_line.split('|')[0]
        if op not in allowed:
            if config.LLM_DEBUG_STREAM:
                _debug_print(f'[LLM filtered] mode={mode} disallowed op: {op_line}')
            continue
        kept_ops.append(op_line)
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
            merged = _parse_merge(op_line, node_parents)
            if merged:
                merge = True
                removes.extend(merged['sources'])
                ghosts.append({
                    'id': merged['id'],
                    'kind': 'idea',
                    'text': merged['text'],
                    'parent': merged['parent'],
                })
            elif config.LLM_DEBUG_STREAM:
                _debug_print(f'[LLM filtered] mode={mode} invalid merge (親が食い違う/IDが不明): {op_line}')
        elif op == 'T+':
            parsed_note = _parse_note(op_line)
            if parsed_note:
                note = parsed_note

    return {
        'title': f'AI提案（{_MODE_LABELS.get(mode, mode)}）',
        'ops': kept_ops,
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


def _debug_print(text, end='\n'):
    """デバッグ出力用のprint。コンソールのエンコード（Windowsのcp932等）で表示できない
    文字があっても、そこで例外にせず代替表示して継続する。"""
    try:
        print(text, end=end, flush=True)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or 'utf-8'
        print(text.encode(encoding, errors='replace').decode(encoding), end=end, flush=True)


def _request_llm_content(model_name, messages, sheet_id, mode, target_node_id):
    """LLMを呼び出し応答テキストを返す。

    LLM_DEBUG_STREAM有効時はstream=Trueで呼び出し、受信したチャンクを
    デバッグ用にサーバーコンソールへ逐次出力する（レスポンス形状・パース処理は変えない）。
    """
    try:
        if config.LLM_DEBUG_STREAM:
            _debug_print(f'[LLM stream] sheet={sheet_id} mode={mode} target={target_node_id}')
            for message in messages:
                _debug_print(f"[LLM prompt:{message['role']}]\n{message['content']}")
            parts = []
            stream = client.chat.completions.create(
                model=model_name,
                messages=messages,
                timeout=LLM_TIMEOUT,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    _debug_print(delta, end='')
                    parts.append(delta)
            _debug_print('')
            return ''.join(parts)

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            timeout=LLM_TIMEOUT,
        )
        return response.choices[0].message.content or ''
    except APIConnectionError:
        raise LLMUnavailableError('Ollamaに接続できません')
    except APITimeoutError:
        raise LLMTimeoutError('LLM推論がタイムアウトしました')
    except APIStatusError as e:
        raise LLMUnavailableError(f'LLM呼び出しに失敗しました: {e.message}')


def request_transaction(model_name, mode, serialized_sheet, target_node_id, system_prompt, sheet_id=None, text=''):
    """LLMにトランザクションを提案させ、フロントエンド向けの提案形状に変換して返す"""
    prompt = _build_prompt(mode, serialized_sheet, target_node_id, text)
    messages = [
        {'role': 'system', 'content': system_prompt if system_prompt else prompt},
    ]
    if system_prompt:
        messages.append({'role': 'user', 'content': prompt})

    content = _request_llm_content(model_name, messages, sheet_id, mode, target_node_id)
    ops, ghosts = sheet_format_service.parse_llm_response(content)
    node_parents = sheet_format_service.parse_node_parents(serialized_sheet)
    return _build_proposal(ops, ghosts, mode, node_parents)


# ============================================================
# エクセプション
# ============================================================

class LLMUnavailableError(Exception):
    """Ollamaに接続できない場合のエクセプション（503）"""


class LLMTimeoutError(Exception):
    """LLM推論がタイムアウトした場合のエクセプション（504）"""
