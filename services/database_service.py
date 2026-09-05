# ============================================================
# プレースホルダーファイル。
# 実装時には、このコメントを含む全てのプレースホルダーコメントを削除すること。
# ============================================================
#
# DB操作サービス（design-document.md 8.3 DB設計）。
# - /storage/db.sqlite: sheets（メタデータ）, app_state（キーバリュー状態）
# - /storage/sheets/{uuid}.json: シート本体を1シート1ファイルで保存（8.1.1 内部保存形式）

import sqlite3
import json
import uuid

DB_PATH = '/storage/db.sqlite'
SHEETS_DIR = '/storage/sheets'


def init_db():
    # TODO: sheets（id, title, created_at, updated_at）
    #       app_state（key PK, value）の2テーブルを作成する
    pass


def list_sheets():
    # TODO: GET /sheets 用 — {id, title, updated_at} の配列を返す
    pass


def create_sheet(title):
    # TODO: POST /sheet 用 — sheets に新規行を追加し、
    #       空の本体（8.1.1）を SHEETS_DIR/{uuid}.json に書き出してIDを返す
    pass


def get_sheet(sheet_id):
    # TODO: GET /sheet/{id} 用 — メタデータ + 本体（SHEETS_DIR/{id}.json）を返す
    pass


def update_sheet(sheet_id, title, body):
    # TODO: PUT /sheet/{id} 用 — メタデータの updated_at を更新し、本体を上書き保存する
    pass


def delete_sheet(sheet_id):
    # TODO: DELETE /sheet/{id} 用 — メタデータ行とファイルを削除する（初期実装は物理削除）
    pass


def get_state():
    # TODO: GET /state 用 — app_state の全キーを返す
    pass


def update_state(partial):
    # TODO: PUT /state 用 — 渡されたキーのみをマージ更新する（存在しないキーは新規追加）
    pass
