# フロントエンドのAPI接続契約

仕様書8.2に従い、以下の形式をフロント側の接続契約とします。模擬応答による検証と実バックエンドとの結合確認は別です。バックエンドが旧形式の場合、バックエンド側の対応が必要です。

- `POST /sheet` 入力 `{title}`、応答 `{id}`。
- `PUT /sheet/{id}` 入力 `{title,nodes,links,groups,notes}`、応答 `{ok:true}`。
- `GET /sheet/{id}` 応答 `{id,title,created_at,updated_at,nodes,links,groups,notes}`。`body` や `metadata` でラップしません。
- `GET /sheets` 応答 `[{id,title,updated_at}]`。
- `DELETE /sheet/{id}` 成功時は `{ok:true}`。
- `GET /models` 応答 `{data:[{id}]}`。モデル名の配列や旧 `models` ラップは受け付けません。
- `GET /state` 応答は設定キーを直接持つオブジェクト。`PUT /state` も `{last_used_model: "..."}` のように設定キーを直接送り、渡されたキーだけを更新。`state` でラップしません。成功応答は `{ok:true}`。
- 設定キーは `last_used_model`、`user_prompt`、`last_opened_sheet_id`。

## AI要求

`POST /ai` の直前にシートの `PUT` が成功する必要があります。未採番シートは先に `POST /sheet` を行います。設定更新の成功も待ちます。

入力は `{model_name,mode,sheet_id,target_node_id,system_prompt,text?}`。

仕様書に未定義の `mode` 値はモックに合わせて `expand`（関連）、`newview`（新視点）、`link`、`merge`、`group`、`note`（要約）、`mutter` としています。全体対象は `target_node_id: ""`。空文字列はそのまま送信し、未指定・`null`・文字列以外は送信前にエラーにします。ひとりごと本文は `text`、システムプロンプトは `system_prompt` で渡します。プロンプトは `/state` の `user_prompt` にも保存します。

## AI応答

仕様書の `{title,ops,ghosts,removes,links,group,note,merge}` を受け取ります。

- `ops`: 表示用の説明文字列配列。**LLMのパイプ記法はフロントで解析しません**。
- `ghosts`: `{id,parent,text}` の配列。新しいIDは実IDへ変換し、親・リンク・グループ参照にも反映。既存IDの場合はテキストと親の更新提案。
- `removes`: 削除予定のノードID配列。通常の削除は子を親へつなぎ直します。
- `links`: `{id?,a,b,comment?}`。既存IDならコメントや端点の更新、新規なら追加。
- `group`: `{id?,members,title,comment?,color?}`。既存IDなら更新。所属の重複は既存グループから移して解消。
- `note`: `{title,body}`。新しいノートとして提案。
- `merge: true`: `removes` の2つ以上のノードを、唯一の `ghosts[0]` へ統合。子とリンクを付け替え、所属は最初に該当するグループに集約。
- 解析済み接続削除・グループ削除用の拡張は `removed_links: string[]`、`removed_groups: string[]`。

テーマ削除、循環、孤立、重複ID、不正参照、同じノード同士の接続、重複接続は提案全体を拒否します。検証済み結果をプレビューし、一括承認時にだけ1履歴として適用します。失敗・却下ではシートを変更しません。提案中は他の編集や保存を無効にします。

仕様書4.4に従い、手動保存・AI直前の自動保存の成功時とシート切替時にUndo/Redo履歴をリセットします。シート保存に失敗した場合は履歴を保持します。自動保存後にAI呼び出しが失敗・却下されても、保存前の履歴は復元しません。AI提案の承認は保存後の新しい1履歴として記録し、承認した変更はUndoできます。
