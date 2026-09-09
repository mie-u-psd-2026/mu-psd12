# 環境設定と組込プロンプトの回帰テスト。
from contextlib import redirect_stdout
import io
import os
from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from services import ai_service, config


class ConfigTest(unittest.TestCase):
    # 一時.envと環境変数から独立した設定を読み込む。
    def readConfig(self, text, environment):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text(text, encoding='utf-8')
            with patch.dict(os.environ, environment, clear=True):
                with patch('dotenv.load_dotenv',
                           side_effect=lambda *args, **kwargs: load_dotenv(path, override=False)) as loader:
                    result = runpy.run_path(config.__file__)
            loader.assert_called_once_with(
                Path(config.__file__).resolve().parent.parent / '.env', override=False)
            return result

    # .envの全設定と型を確認する。
    def testDotenvSettings(self):
        values = self.readConfig(
            'FLASK_HOST=127.0.0.2\nFLASK_PORT=5012\nFLASK_DEBUG=false\n'
            'STORAGE_DIR=./test-storage\nOLLAMA_BASE_URL=http://localhost:12345/v1\n'
            'OLLAMA_API_KEY=test-key\nLLM_TIMEOUT=2.5\n', {})
        self.assertEqual(values['FLASK_HOST'], '127.0.0.2')
        self.assertEqual(values['FLASK_PORT'], 5012)
        self.assertIs(values['FLASK_DEBUG'], False)
        self.assertEqual(values['STORAGE_DIR'], './test-storage')
        self.assertEqual(values['OLLAMA_BASE_URL'], 'http://localhost:12345/v1')
        self.assertEqual(values['OLLAMA_API_KEY'], 'test-key')
        self.assertEqual(values['LLM_TIMEOUT'], 2.5)

    # 環境変数が.envより優先されることを確認する。
    def testEnvironmentWins(self):
        values = self.readConfig('FLASK_PORT=5012\nOLLAMA_API_KEY=file-key\n',
                                 {'FLASK_PORT': '6012', 'OLLAMA_API_KEY': 'environment-key'})
        self.assertEqual(values['FLASK_PORT'], 6012)
        self.assertEqual(values['OLLAMA_API_KEY'], 'environment-key')

    # 設定省略時の既定値を確認する。
    def testDefaults(self):
        values = self.readConfig('', {})
        self.assertEqual(values['FLASK_HOST'], '0.0.0.0')
        self.assertEqual(values['FLASK_PORT'], 5000)
        self.assertIs(values['FLASK_DEBUG'], True)
        self.assertEqual(values['STORAGE_DIR'],
                          str(Path(config.__file__).resolve().parent.parent / 'storage'))
        self.assertEqual(values['OLLAMA_BASE_URL'], 'http://localhost:11434/v1')
        self.assertEqual(values['OLLAMA_API_KEY'], 'ollama')
        self.assertEqual(values['LLM_TIMEOUT'], 120)


class PromptTest(unittest.TestCase):
    # .envの実際の値（LLM_DEBUG_STREAM等）に依存しないよう、既定でOFFに固定する。
    def setUp(self):
        patcher = patch.object(config, 'LLM_DEBUG_STREAM', False)
        patcher.start()
        self.addCleanup(patcher.stop)

    # プロンプト前後の固定文言（出力制約）を確認する。
    def testBaseFormat(self):
        base = ai_service._SYSTEM_INTRO + ai_service._SYSTEM_OUTRO
        for token in ('text/commentに|や改行', 'new接頭辞', '操作行のみ'):
            with self.subTest(token=token):
                self.assertIn(token, base)

    # モードごとに許可された操作だけが出力形式として提示されることを確認する。
    def testModeAllowedOps(self):
        for mode, allowed in ai_service._MODE_ALLOWED_OPS.items():
            with self.subTest(mode=mode):
                base = ai_service._build_system_base(mode)
                for op, description in ai_service._OP_DESCRIPTIONS.items():
                    if op in allowed:
                        self.assertIn(description, base)
                    else:
                        self.assertNotIn(description, base)

    # mutterモードは全操作を許可することを確認する。
    def testMutterAllowsAllOps(self):
        self.assertEqual(set(ai_service._MODE_ALLOWED_OPS['mutter']), set(ai_service._OP_DESCRIPTIONS))

    # 各モードの指示と対象シートを確認する。
    def testModeInstructions(self):
        modes = {'expand': '子ノードを3つ程度', 'newview': '根直下のノードを2つ程度',
                 'link': '間接エッジで接続', 'merge': '兄弟ノードを統合',
                 'group': '子孫を意味的にまとめて', 'note': 'シート全体の要約',
                 'mutter': 'ユーザーの入力（ひとりごと）を読み取り'}
        for mode, instruction in modes.items():
            with self.subTest(mode=mode):
                prompt = ai_service._build_prompt(mode, 'N|n0|-|テーマ', 'n0')
                self.assertIn(ai_service._SYSTEM_INTRO, prompt)
                self.assertIn(instruction, prompt)
                self.assertIn('## 対象ノードID\nn0', prompt)
                self.assertIn('N|n0|-|テーマ', prompt)

    # 未知のモードの既定指示を確認する。
    def testUnknownMode(self):
        prompt = ai_service._build_prompt('unknown', 'N|n0|-|テーマ', '')
        self.assertIn('適切な提案を行ってください。', prompt)
        self.assertIn('N|n0|-|テーマ', prompt)

    # 通常時とカスタム指定時のLLM送信内容を確認する。
    def testRequestMessages(self):
        response = SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content='N+|new1|n0|アイデア'))])
        for custom in ('', '短く日本語で回答してください'):
            with self.subTest(custom=custom):
                with patch.object(ai_service.client.chat.completions, 'create',
                                  return_value=response) as create:
                    proposal = ai_service.request_transaction(
                        'test-model', 'expand', 'N|n0|-|テーマ', 'n0', custom)
                args = create.call_args.kwargs
                self.assertEqual(args['model'], 'test-model')
                self.assertEqual(args['timeout'], config.LLM_TIMEOUT)
                messages = args['messages']
                self.assertEqual(messages[0]['role'], 'system')
                if custom:
                    self.assertEqual(messages[0]['content'], custom)
                    self.assertEqual(messages[1]['role'], 'user')
                self.assertEqual(len(messages), 2 if custom else 1)
                self.assertIn(ai_service._SYSTEM_INTRO, messages[-1]['content'])
                self.assertIn('N|n0|-|テーマ', messages[-1]['content'])
                self.assertIn('子ノードを3つ程度', messages[-1]['content'])
                self.assertEqual(proposal['ghosts'][0]['text'], 'アイデア')

    # mutterモードのtextがプロンプトに含まれることを確認する。
    def testMutterTextIncludedInPrompt(self):
        prompt = ai_service._build_prompt('mutter', 'N|n0|-|テーマ', '', 'これはひとりごとです')
        self.assertIn('## ユーザーの入力\nこれはひとりごとです', prompt)

    # textが空の場合、入力セクションを付与しないことを確認する。
    def testTextOmittedWhenEmpty(self):
        prompt = ai_service._build_prompt('expand', 'N|n0|-|テーマ', 'n0')
        self.assertNotIn('## ユーザーの入力', prompt)

    # request_transaction経由でtextがLLMへのメッセージに渡ることを確認する。
    def testMutterTextReachesLlm(self):
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=''))])
        with patch.object(ai_service.client.chat.completions, 'create', return_value=response) as create:
            ai_service.request_transaction(
                'test-model', 'mutter', 'N|n0|-|テーマ', '', '', text='これはひとりごとです')
        messages = create.call_args.kwargs['messages']
        self.assertIn('これはひとりごとです', messages[-1]['content'])

    # noteモードでLLMがT+行を返した場合、proposal['note']に反映されることを確認する。
    def testNoteProposal(self):
        response = SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content='T+|new1|要約|本文です'))])
        with patch.object(ai_service.client.chat.completions, 'create', return_value=response):
            proposal = ai_service.request_transaction(
                'test-model', 'note', 'N|n0|-|テーマ', '', '')
        self.assertEqual(proposal['note'], {'id': 'new1', 'title': '要約', 'body': '本文です'})

    # mergeモードはM行から兄弟ノードの統合をghosts/removesへ合成することを確認する。
    def testMergeSynthesizesGhostFromSiblings(self):
        response = SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content='M|new1|a,b|統合後'))])
        sheet = 'N|n0|-|テーマ\nN|a|n0|A\nN|b|n0|B'
        with patch.object(ai_service.client.chat.completions, 'create', return_value=response):
            proposal = ai_service.request_transaction('test-model', 'merge', sheet, 'a', '')
        self.assertTrue(proposal['merge'])
        self.assertEqual(sorted(proposal['removes']), ['a', 'b'])
        ghost = next(g for g in proposal['ghosts'] if g['id'] == 'new1')
        self.assertEqual(ghost['text'], '統合後')
        self.assertEqual(ghost['parent'], 'n0')

    # 統合元の親が食い違う場合、M行を不正行として読み飛ばすことを確認する。
    def testMergeRejectsMismatchedParents(self):
        response = SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content='M|new1|a,c|統合後'))])
        sheet = 'N|n0|-|テーマ\nN|a|n0|A\nN|b|n0|B\nN|c|b|C'
        with patch.object(ai_service.client.chat.completions, 'create', return_value=response):
            proposal = ai_service.request_transaction('test-model', 'merge', sheet, 'a', '')
        self.assertFalse(proposal['merge'])
        self.assertEqual(proposal['removes'], [])
        self.assertFalse(any(ghost['id'] == 'new1' for ghost in proposal['ghosts']))

    # 親が食い違うM行は、LLM_DEBUG_STREAM有効時にログ出力されることを確認する。
    def testMergeMismatchedParentsLoggedWhenDebugStreamEnabled(self):
        chunks = [SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='M|new1|a,c|統合後'))])]
        sheet = 'N|n0|-|テーマ\nN|a|n0|A\nN|b|n0|B\nN|c|b|C'
        with patch.object(config, 'LLM_DEBUG_STREAM', True):
            with patch.object(ai_service.client.chat.completions, 'create', return_value=iter(chunks)):
                output = io.StringIO()
                with redirect_stdout(output):
                    ai_service.request_transaction('test-model', 'merge', sheet, 'a', '')
        self.assertIn('[LLM filtered] mode=merge invalid merge', output.getvalue())

    # モードで許可されていない操作行は提案から除外されることを確認する。
    def testDisallowedOpIsFilteredOut(self):
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
            content='N+|new1|n0|アイデア\nG+|newG|n0|グループ|コメント'))])
        with patch.object(ai_service.client.chat.completions, 'create', return_value=response):
            proposal = ai_service.request_transaction('test-model', 'expand', 'N|n0|-|テーマ', 'n0', '')
        self.assertEqual(proposal['ops'], ['N+|new1|n0|アイデア'])
        self.assertIsNone(proposal['group'])

    # LLM_DEBUG_STREAM有効時、除外した行がコンソールへログ出力されることを確認する。
    def testDisallowedOpLoggedWhenDebugStreamEnabled(self):
        chunks = [SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(
            content='N+|new1|n0|アイデア\nG+|newG|n0|グループ|コメント'))])]
        with patch.object(config, 'LLM_DEBUG_STREAM', True):
            with patch.object(ai_service.client.chat.completions, 'create', return_value=iter(chunks)):
                output = io.StringIO()
                with redirect_stdout(output):
                    proposal = ai_service.request_transaction('test-model', 'expand', 'N|n0|-|テーマ', 'n0', '')
        self.assertIn('[LLM filtered] mode=expand disallowed op: G+|newG|n0|グループ|コメント', output.getvalue())
        self.assertEqual(proposal['ops'], ['N+|new1|n0|アイデア'])

    # LLM_DEBUG_STREAM=false時はstream=Trueを渡さないことを確認する。
    def testDebugStreamDisabledByDefault(self):
        response = SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content='N+|new1|n0|アイデア'))])
        with patch.object(config, 'LLM_DEBUG_STREAM', False):
            with patch.object(ai_service.client.chat.completions, 'create',
                              return_value=response) as create:
                ai_service.request_transaction('test-model', 'expand', 'N|n0|-|テーマ', 'n0', '')
        self.assertNotIn('stream', create.call_args.kwargs)

    # LLM_DEBUG_STREAM=true時はstream=Trueで呼び出し、応答をコンソールへ逐次出力することを確認する。
    def testDebugStreamOutputsChunksToConsole(self):
        chunks = [
            SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='N+|new1'))]),
            SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='|n0|アイデア'))]),
        ]
        with patch.object(config, 'LLM_DEBUG_STREAM', True):
            with patch.object(ai_service.client.chat.completions, 'create',
                              return_value=iter(chunks)) as create:
                output = io.StringIO()
                with redirect_stdout(output):
                    proposal = ai_service.request_transaction(
                        'test-model', 'expand', 'N|n0|-|テーマ', 'n0', '', sheet_id='sheet1')
        self.assertIs(create.call_args.kwargs['stream'], True)
        printed = output.getvalue()
        self.assertIn('sheet=sheet1 mode=expand target=n0', printed)
        self.assertIn('[LLM prompt:system]', printed)
        self.assertIn(ai_service._SYSTEM_INTRO, printed)
        self.assertIn('N|n0|-|テーマ', printed)
        self.assertIn('N+|new1|n0|アイデア', printed)
        self.assertEqual(proposal['ghosts'][0]['text'], 'アイデア')


if __name__ == '__main__':
    unittest.main()
