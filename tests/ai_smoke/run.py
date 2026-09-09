# AI機能ごとの応答フォーマット準拠を確認する診断スクリプト。
# 決定的な単体テストではなく、実行中のOllamaに対して任意実行する（.venv経由）。
# 同じモードを複数回実行し、失敗傾向をresults.jsonlに蓄積してプロンプト改善に使う。

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from services import ai_service

RESULTS_PATH = Path(__file__).resolve().parent / 'results.jsonl'

# 固定のテスト用シート（design-document.md 8.1.2のLLM向けシリアライズ形式）。
_SHEET = (
    'N|n0|-|あたらしい和菓子の開発\n'
    'N|n1|n0|伝統的な素材と技術の活用\n'
    'N|n2|n0|西洋の影響を受けた新規デザイン\n'
    'N|n3|n0|若者向け\n'
    'N|n4|n1|抹茶を使った新しいお菓子\n'
    'N|n5|n1|抹茶風味の新商品\n'
    'L|l0|n2|n3|洋風×若者向けの組み合わせ\n'
    'G|g0|n2,n3|新デザイン案|検討中\n'
    'T|既存メモ|要約前のメモです\n'
)

# モードごとの対象ノードID（design-document.md 4.5〜4.7の各機能の対象）。
_MODE_TARGETS = {
    'expand': 'n1',
    'newview': '',
    'link': 'n1',
    'merge': 'n4',
    'group': 'n1',
    'note': '',
    'mutter': '',
}
_MUTTER_TEXT = '若者向けに抹茶と洋風デザインを組み合わせた新商品を考えたい'


def _check(mode, proposal):
    """モードごとに期待するフィールドが埋まっているかを確認し、(成否, 理由)を返す"""
    if not proposal['ops']:
        return False, '許可された操作が1つも出力されなかった'
    if mode in ('expand', 'newview') and not proposal['ghosts']:
        return False, 'ノードが追加されなかった'
    if mode == 'link' and not proposal['links']:
        return False, '間接エッジが追加されなかった'
    if mode == 'merge' and not (proposal['merge'] and proposal['ghosts']):
        return False, '統合が成立しなかった'
    if mode == 'group' and not proposal['group']:
        return False, 'グループが作成されなかった'
    if mode == 'note' and not proposal['note']:
        return False, 'ノートが作成されなかった'
    return True, ''


def run_once(model, mode):
    """1回分の実行結果（成否・理由・生のプロンプト/応答）を返す"""
    target = _MODE_TARGETS[mode]
    text = _MUTTER_TEXT if mode == 'mutter' else ''
    prompt = ai_service._build_prompt(mode, _SHEET, target, text)
    messages = [{'role': 'system', 'content': prompt}]
    try:
        content = ai_service._request_llm_content(model, messages, None, mode, target)
        ops, ghosts = ai_service.sheet_format_service.parse_llm_response(content)
        node_parents = ai_service.sheet_format_service.parse_node_parents(_SHEET)
        proposal = ai_service._build_proposal(ops, ghosts, mode, node_parents)
    except Exception as error:  # 診断ツールのため、接続断・タイムアウト等も含めて広く捕捉する
        return {'passed': False, 'reason': f'例外: {error}', 'prompt': prompt, 'response': None, 'ops': []}
    passed, reason = _check(mode, proposal)
    return {'passed': passed, 'reason': reason, 'prompt': prompt, 'response': content, 'ops': proposal['ops']}


def main():
    parser = argparse.ArgumentParser(description='AI機能ごとの応答フォーマット準拠を確認する診断スクリプト')
    parser.add_argument('--model', required=True, help='テストするOllamaモデル名')
    parser.add_argument('--runs', type=int, default=5, help='各モードの実行回数（既定5回）')
    parser.add_argument('--modes', nargs='*', default=list(_MODE_TARGETS), help='テストするモード（既定は全モード）')
    args = parser.parse_args()

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    summary = {}
    with RESULTS_PATH.open('a', encoding='utf-8') as log:
        for mode in args.modes:
            successes = 0
            for i in range(args.runs):
                result = run_once(args.model, mode)
                if result['passed']:
                    successes += 1
                record = {
                    'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
                    'model': args.model,
                    'mode': mode,
                    'attempt': i + 1,
                    **result,
                }
                log.write(json.dumps(record, ensure_ascii=False) + '\n')
                log.flush()
                status = 'PASS' if result['passed'] else 'FAIL - ' + result['reason']
                print(f'  [{mode}] {i + 1}/{args.runs}: {status}')
            summary[mode] = (successes, args.runs)

    print('\n=== 結果まとめ ===')
    for mode, (successes, total) in summary.items():
        print(f'{mode}: {successes}/{total} ({successes / total:.0%})')
    print(f'\n詳細ログ: {RESULTS_PATH}')


if __name__ == '__main__':
    main()
