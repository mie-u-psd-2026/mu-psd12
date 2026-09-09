# 環境設定と組込プロンプトの回帰テスト。
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
        self.assertEqual(values['STORAGE_DIR'], '/storage')
        self.assertEqual(values['OLLAMA_BASE_URL'], 'http://localhost:11434/v1')
        self.assertEqual(values['OLLAMA_API_KEY'], 'ollama')
        self.assertEqual(values['LLM_TIMEOUT'], 120)


class PromptTest(unittest.TestCase):
    # 基本プロンプトの操作形式と出力制約を確認する。
    def testBaseFormat(self):
        for token in ('N+|newId|parentId|text', 'N-|id', 'N~|id|text',
                      'L+|newId|nodeA|nodeB|comment', 'L-|id',
                      'G+|newId|memberIds(,区切り)|title|comment', 'M|id,id|text',
                      'text/commentに|や改行', 'new接頭辞', '操作行のみ'):
            with self.subTest(token=token):
                self.assertIn(token, ai_service._SYSTEM_BASE)

    # 各モードの指示と対象シートを確認する。
    def testModeInstructions(self):
        modes = {'expand': '子ノードを3つ程度', 'newview': '根直下のノードを2つ程度',
                 'link': '間接エッジで接続', 'merge': '兄弟ノードを統合',
                 'group': '子孫を意味的にまとめて', 'note': 'シート全体の要約'}
        for mode, instruction in modes.items():
            with self.subTest(mode=mode):
                prompt = ai_service._build_prompt(mode, 'N|n0|-|テーマ', 'n0')
                self.assertIn(ai_service._SYSTEM_BASE, prompt)
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
                self.assertIn(ai_service._SYSTEM_BASE, messages[-1]['content'])
                self.assertIn('N|n0|-|テーマ', messages[-1]['content'])
                self.assertIn('子ノードを3つ程度', messages[-1]['content'])
                self.assertEqual(proposal['ghosts'][0]['text'], 'アイデア')


if __name__ == '__main__':
    unittest.main()
