# database_service / sheet_format_service / APIエンドポイントの単体テスト。

import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from services import ai_service, database_service, sheet_format_service


def _sample_body():
    return {
        'nodes': [
            {'id': 'n0', 'kind': 'theme', 'text': 'テーマ', 'parent': None},
            {'id': 'n1', 'kind': 'idea', 'text': 'アイデアA', 'parent': 'n0'},
        ],
        'links': [
            {'id': 'l1', 'a': 'n0', 'b': 'n1', 'comment': '関連'},
        ],
        'groups': [
            {'id': 'g1', 'members': ['n0', 'n1'], 'title': 'グループ', 'comment': '', 'color': '#A8D5BA'},
        ],
        'notes': [
            {'id': 'note1', 'title': 'ノート', 'body': '本文'},
        ],
    }


class SheetFormatServiceTest(unittest.TestCase):

    def test_serialize_for_llm(self):
        body = _sample_body()
        text = sheet_format_service.serialize_for_llm(body)
        lines = [l for l in text.split('\n') if l]
        self.assertTrue(any(l.startswith('N|n0|-|テーマ') for l in lines))
        self.assertTrue(any(l.startswith('N|n1|n0|アイデアA') for l in lines))
        self.assertTrue(any(l.startswith('L|l1|n0|n1|関連') for l in lines))
        self.assertTrue(any(l.startswith('G|g1|n0,n1|グループ|') for l in lines))
        self.assertTrue(any(l.startswith('T|ノート|本文') for l in lines))

    def test_serialize_escapes_pipe_and_newline(self):
        body = {
            'nodes': [{'id': 'n0', 'kind': 'theme', 'text': 'a|b\nc', 'parent': None}],
            'links': [], 'groups': [], 'notes': [],
        }
        text = sheet_format_service.serialize_for_llm(body)
        self.assertNotIn('a|b', text)
        self.assertNotIn('\n', text.splitlines()[0] if text else '')

    def test_parse_llm_response_ok(self):
        text = (
            'N+|new1|n0|新しいアイデア\n'
            'N-|n1\n'
            'L+|newL|n0|n1|関連付け\n'
            'G+|newG|n0,n1|新グループ|メモ\n'
            'M|n0,n1|統合テキスト\n'
            'N~|n1|編集後\n'
        )
        ops, ghosts = sheet_format_service.parse_llm_response(text)
        self.assertEqual(len(ops), 6)
        self.assertEqual(len(ghosts), 1)
        self.assertEqual(ghosts[0]['text'], '新しいアイデア')
        self.assertEqual(ghosts[0]['parent'], 'n0')

    def test_parse_llm_response_skips_broken_lines(self):
        text = 'N+|new1|n0|ok\n壊れた行\nX|y\nN-|n1\n'
        ops, ghosts = sheet_format_service.parse_llm_response(text)
        self.assertEqual(len(ops), 2)
        self.assertEqual(len(ghosts), 1)

    def test_to_from_export_format(self):
        body = _sample_body()
        metadata = {'title': 'T', 'created_at': 'c', 'updated_at': 'u'}
        exported = sheet_format_service.to_export_format(body, metadata)
        self.assertEqual(exported['metadata']['title'], 'T')
        imported_body, imported_meta = sheet_format_service.from_import_format(exported)
        self.assertEqual(imported_meta['title'], 'T')
        self.assertEqual(imported_body['nodes'], body['nodes'])


class DatabaseServiceTest(unittest.TestCase):

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        patch1 = patch.object(database_service, 'STORAGE_DIR', self._tmpdir.name)
        patch2 = patch.object(database_service, 'DB_PATH',
                              os.path.join(self._tmpdir.name, 'db.sqlite'))
        patch3 = patch.object(database_service, 'SHEETS_DIR',
                              os.path.join(self._tmpdir.name, 'sheets'))
        patch1.start()
        patch2.start()
        patch3.start()
        self.addCleanup(patch3.stop)
        self.addCleanup(patch2.stop)
        self.addCleanup(patch1.stop)
        self.addCleanup(self._tmpdir.cleanup)
        database_service.init_db()

    def test_create_and_get_sheet(self):
        sheet_id = database_service.create_sheet('シート1')
        sheet = database_service.get_sheet(sheet_id)
        self.assertEqual(sheet['title'], 'シート1')
        self.assertEqual(sheet['body']['nodes'][0]['id'], 'n0')

    def test_list_sheets(self):
        database_service.create_sheet('A')
        database_service.create_sheet('B')
        sheets = database_service.list_sheets()
        self.assertEqual(len(sheets), 2)
        self.assertIn({'id': None, 'title': 'A', 'updated_at': None}['title'], [s['title'] for s in sheets])

    def test_update_sheet(self):
        sheet_id = database_service.create_sheet('A')
        new_body = {
            'nodes': [{'id': 'n0', 'kind': 'theme', 'text': '変更', 'parent': None}],
            'links': [], 'groups': [], 'notes': [],
        }
        self.assertTrue(database_service.update_sheet(sheet_id, 'B', new_body))
        sheet = database_service.get_sheet(sheet_id)
        self.assertEqual(sheet['title'], 'B')
        self.assertEqual(sheet['body']['nodes'][0]['text'], '変更')

    def test_update_missing_sheet_returns_false(self):
        self.assertFalse(database_service.update_sheet('missing', 't', {}))

    def test_delete_sheet(self):
        sheet_id = database_service.create_sheet('A')
        self.assertTrue(database_service.delete_sheet(sheet_id))
        self.assertIsNone(database_service.get_sheet(sheet_id))
        self.assertFalse(database_service.delete_sheet(sheet_id))

    def test_state_merge(self):
        database_service.update_state({'a': 1, 'b': 2})
        database_service.update_state({'b': 3, 'c': 4})
        state = database_service.get_state()
        self.assertEqual(json.loads(state['a']), 1)
        self.assertEqual(json.loads(state['b']), 3)
        self.assertEqual(json.loads(state['c']), 4)


class ApiErrorFormatTest(unittest.TestCase):
    """共通エラー形式と主要APIエンドポイントの動作確認"""

    def _make_app(self):
        from app import app
        app.testing = True
        return app

    def _patch_storage(self):
        tmpdir = tempfile.TemporaryDirectory()
        patches = [
            patch.object(database_service, 'STORAGE_DIR', tmpdir.name),
            patch.object(database_service, 'DB_PATH', os.path.join(tmpdir.name, 'db.sqlite')),
            patch.object(database_service, 'SHEETS_DIR', os.path.join(tmpdir.name, 'sheets')),
        ]
        for p in patches:
            p.start()
        self._cleanup = lambda: (patches[2].stop(), patches[1].stop(),
                                 patches[0].stop(), tmpdir.cleanup())
        database_service.init_db()
        return self._make_app()

    def tearDown(self):
        if hasattr(self, '_cleanup'):
            self._cleanup()

    def test_get_models_error_format(self):
        app = self._patch_storage()
        with patch.object(ai_service, 'list_models',
                          side_effect=ai_service.LLMUnavailableError('no conn')):
            client = app.test_client()
            resp = client.get('/models')
            self.assertEqual(resp.status_code, 503)
            self.assertEqual(resp.get_json()['error']['code'], 'llm_unavailable')

    def test_get_missing_sheet_returns_not_found(self):
        app = self._patch_storage()
        client = app.test_client()
        resp = client.get('/sheet/missing')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.get_json()['error']['code'], 'not_found')

    def test_create_and_get_sheet_api(self):
        # design-document.md 8.2: GET /sheet/{id}はnodes/links/groups/notesをbodyでネストせずフラット展開する
        app = self._patch_storage()
        client = app.test_client()
        create = client.post('/sheet', json={'title': 'APIシート'})
        self.assertEqual(create.status_code, 201)
        sheet_id = create.get_json()['id']
        get = client.get(f'/sheet/{sheet_id}')
        self.assertEqual(get.status_code, 200)
        data = get.get_json()
        self.assertEqual(data['title'], 'APIシート')
        for key in ('nodes', 'links', 'groups', 'notes'):
            self.assertIn(key, data)
        self.assertNotIn('body', data)

    def test_update_sheet_api_flat_body(self):
        # design-document.md 8.2: PUT /sheet/{id}のリクエストボディはbodyでネストせずフラットに送る
        app = self._patch_storage()
        client = app.test_client()
        sheet_id = client.post('/sheet', json={'title': 'A'}).get_json()['id']
        flat_body = {'title': 'B', 'nodes': [{'id': 'n0', 'kind': 'theme', 'text': '変更後', 'parent': None}],
                     'links': [], 'groups': [], 'notes': []}
        resp = client.put(f'/sheet/{sheet_id}', json=flat_body)
        self.assertEqual(resp.status_code, 200)
        get = client.get(f'/sheet/{sheet_id}').get_json()
        self.assertEqual(get['title'], 'B')
        self.assertEqual(get['nodes'][0]['text'], '変更後')

    def test_update_sheet_api_validation(self):
        app = self._patch_storage()
        client = app.test_client()
        sheet_id = client.post('/sheet', json={'title': 'A'}).get_json()['id']
        resp = client.put(f'/sheet/{sheet_id}', json={'title': 'A'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json()['error']['code'], 'validation')

    def test_get_sheets_returns_bare_array(self):
        # design-document.md 8.2: GET /sheetsは{sheets:[...]}でラップせずbare配列で返す
        app = self._patch_storage()
        client = app.test_client()
        client.post('/sheet', json={'title': 'A'})
        data = client.get('/sheets').get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(data[0]['title'], 'A')

    def test_state_api(self):
        # design-document.md 8.2: GET/PUT /stateは{state:{...}}でラップせずキーバリューを直接扱う
        app = self._patch_storage()
        client = app.test_client()
        self.assertEqual(client.put('/state', json={'key': 'v'}).status_code, 200)
        resp = client.get('/state')
        self.assertEqual(resp.get_json()['key'], '"v"')

    def test_get_models_openai_compatible_format(self):
        # design-document.md 8.2: {"data": [{"id": "..."}]}のOpenAI互換形式で透過する
        app = self._patch_storage()
        with patch.object(ai_service, 'list_models', return_value=['qwen3.5:0.8b']):
            client = app.test_client()
            resp = client.get('/models')
        self.assertEqual(resp.get_json(), {'data': [{'id': 'qwen3.5:0.8b'}]})

    def test_ai_empty_target_node_id_means_whole_sheet(self):
        # design-document.md 8.2: target_node_id=""はシート全体対象として有効。必須チェックで弾いてはならない
        app = self._patch_storage()
        client = app.test_client()
        sheet_id = client.post('/sheet', json={'title': 'A'}).get_json()['id']
        proposal = {'title': 'AI提案', 'ops': [], 'ghosts': [], 'removes': [],
                    'links': [], 'group': None, 'note': None, 'merge': False}
        with patch.object(ai_service, 'request_transaction', return_value=proposal):
            resp = client.post('/ai', json={'model_name': 'local-model', 'mode': 'note',
                                             'sheet_id': sheet_id, 'target_node_id': ''})
        self.assertEqual(resp.status_code, 200)

    def test_delete_missing_sheet_returns_not_found(self):
        app = self._patch_storage()
        client = app.test_client()
        resp = client.delete('/sheet/missing')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.get_json()['error']['code'], 'not_found')

    def test_ai_success(self):
        app = self._patch_storage()
        client = app.test_client()
        sheet_id = client.post('/sheet', json={'title': 'A'}).get_json()['id']
        proposal = {'title': 'AI提案', 'ops': [], 'ghosts': [], 'removes': [],
                    'links': [], 'group': None, 'note': None, 'merge': False}
        with patch.object(ai_service, 'request_transaction', return_value=proposal):
            resp = client.post('/ai', json={'model_name': 'local-model', 'mode': 'expand',
                                             'sheet_id': sheet_id, 'target_node_id': 'n0'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['title'], 'AI提案')

    def test_ai_llm_timeout(self):
        app = self._patch_storage()
        client = app.test_client()
        sheet_id = client.post('/sheet', json={'title': 'A'}).get_json()['id']
        with patch.object(ai_service, 'request_transaction',
                          side_effect=ai_service.LLMTimeoutError('timeout')):
            resp = client.post('/ai', json={'model_name': 'local-model', 'mode': 'expand',
                                             'sheet_id': sheet_id, 'target_node_id': 'n0'})
        self.assertEqual(resp.status_code, 504)
        self.assertEqual(resp.get_json()['error']['code'], 'llm_timeout')

    def test_ai_missing_fields_returns_validation(self):
        app = self._patch_storage()
        client = app.test_client()
        resp = client.post('/ai', json={'model_name': 'local-model'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json()['error']['code'], 'validation')

    def test_internal_error_format(self):
        app = self._patch_storage()
        client = app.test_client()
        sheet_id = client.post('/sheet', json={'title': 'A'}).get_json()['id']
        with patch.object(sheet_format_service, 'serialize_for_llm', side_effect=RuntimeError('boom')):
            resp = client.post('/ai', json={'model_name': 'local-model', 'mode': 'expand',
                                             'sheet_id': sheet_id, 'target_node_id': 'n0'})
        self.assertEqual(resp.status_code, 500)
        self.assertEqual(resp.get_json()['error']['code'], 'internal_error')


if __name__ == '__main__':
    unittest.main()
