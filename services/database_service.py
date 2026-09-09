# DB操作サービス（design-document.md 8.3 DB設計）。
# - /storage/db.sqlite: sheets（メタデータ）, app_state（キーバリュー状態）
# - /storage/sheets/{uuid}.json: シート本体を1シート1ファイルで保存（8.1.1 内部保存形式）

import json
import os
import sqlite3
import uuid

from services import config

# シートとデータベースの保存先。
STORAGE_DIR = config.STORAGE_DIR
DB_PATH = os.path.join(STORAGE_DIR, 'db.sqlite')
SHEETS_DIR = os.path.join(STORAGE_DIR, 'sheets')


def _now_iso():
    """ISO形式の現在日時文字列を返す"""
    return __import__('datetime').datetime.now().isoformat()


def _connect():
    """DB接続を返す（外部キー・行指定は不要なシンプル構成）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_storage():
    """保存先ディレクトリを用意する"""
    os.makedirs(SHEETS_DIR, exist_ok=True)


def init_db():
    """sheets / app_state の2テーブルを作成する"""
    _ensure_storage()
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sheets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def list_sheets():
    """全シートの {id, title, updated_at} の一覧を返す"""
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT id, title, updated_at
            FROM sheets
            ORDER BY updated_at DESC
            """
        ).fetchall()
        return [{'id': r['id'], 'title': r['title'], 'updated_at': r['updated_at']} for r in rows]
    finally:
        conn.close()


def create_sheet(title):
    """新規シートを作成し、身体を空で書き出してIDを返す"""
    _ensure_storage()
    sheet_id = str(uuid.uuid4())
    now = _now_iso()
    empty_body = {
        'nodes': [{'id': 'n0', 'kind': 'theme', 'text': '', 'parent': None}],
        'links': [],
        'groups': [],
        'notes': [],
    }

    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO sheets (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (sheet_id, title, now, now),
        )
        conn.commit()
    finally:
        conn.close()

    _write_body(sheet_id, empty_body)
    return sheet_id


def _body_path(sheet_id):
    """シート本体のファイルパスを返す"""
    return os.path.join(SHEETS_DIR, f'{sheet_id}.json')


def _read_body(sheet_id):
    """シート本体を読み込んで返す"""
    path = _body_path(sheet_id)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _write_body(sheet_id, body):
    """シート本体を書き出す"""
    path = _body_path(sheet_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(body, f, ensure_ascii=False)


def _sheet_exists(sheet_id):
    """シートが存在するか確認する"""
    conn = _connect()
    try:
        row = conn.execute("SELECT id FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
        return row is not None
    finally:
        conn.close()


def get_sheet(sheet_id):
    """シートのメタデータと本体を返す。存在しない場合はNoneを返す"""
    if not _sheet_exists(sheet_id):
        return None
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT id, title, created_at, updated_at FROM sheets WHERE id = ?",
            (sheet_id,),
        ).fetchone()
    finally:
        conn.close()
    body = _read_body(sheet_id)
    return {
        'id': row['id'],
        'title': row['title'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
        'body': body,
    }


def update_sheet(sheet_id, title, body):
    """シートのメタデータ（updated_at）と本体を更新する"""
    _ensure_storage()
    if not _sheet_exists(sheet_id):
        return False
    now = _now_iso()
    conn = _connect()
    try:
        conn.execute(
            "UPDATE sheets SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, sheet_id),
        )
        conn.commit()
    finally:
        conn.close()
    _write_body(sheet_id, body)
    return True


def delete_sheet(sheet_id):
    """シートのメタデータ行と本体ファイルを物理削除する"""
    if not _sheet_exists(sheet_id):
        return False
    conn = _connect()
    try:
        conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
        conn.commit()
    finally:
        conn.close()
    path = _body_path(sheet_id)
    if os.path.exists(path):
        os.remove(path)
    return True


def get_state():
    """app_state の全キー/値を返す"""
    conn = _connect()
    try:
        rows = conn.execute("SELECT key, value FROM app_state").fetchall()
        return {r['key']: r['value'] for r in rows}
    finally:
        conn.close()


def update_state(partial):
    """渡されたキーのみ app_state にマージ更新する"""
    conn = _connect()
    try:
        for key, value in partial.items():
            conn.execute(
                """
                INSERT INTO app_state (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, json.dumps(value)),
            )
        conn.commit()
    finally:
        conn.close()
