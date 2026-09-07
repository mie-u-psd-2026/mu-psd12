// シート編集、履歴、ファイル入出力、サーバー保存の共有状態。
import { computed, ref } from 'vue';
import { useSheetState } from './useSheetState.js';
import { useUndoRedo } from './useUndoRedo.js';
import { useApiClient } from './useApiClient.js';
import { createEmptySheet, parseSheet } from '../utils/sheet_format.js';

// 画面から呼び出すシート操作と表示状態を返す。
export function useSheetSession() {
  const { sheetState, addNode, updateNodeText } = useSheetState();
  const history = useUndoRedo();
  const api = useApiClient();
  const title = ref('無題のシート');
  const sheetId = ref(null);
  const createdAt = ref(new Date().toISOString());
  const updatedAt = ref(createdAt.value);
  const version = ref(0);
  const isBusy = ref(false);
  const message = ref('');
  const hasError = ref(false);
  const sheets = ref([]);
  const isListOpen = ref(false);
  const pendingAction = ref(null);
  const savedSnapshot = ref(snapshot());
  const hasChanges = computed(() => snapshot() !== savedSnapshot.value);

  // タイトルとシート本体を履歴用JSONに変換して返す。
  function snapshot() {
    return JSON.stringify({ title: title.value, ...sheetState });
  }

  // 通知文とエラー状態を更新する。
  function notify(text, isError = false) {
    message.value = text;
    hasError.value = isError;
  }

  // 一操作を実行し、変更前後を履歴へ記録する。
  function edit(operation) {
    if (isBusy.value) return;
    const before = snapshot();
    operation();
    history.record(before, snapshot());
    message.value = '';
  }

  // タイトルを受け取り、空欄以外の編集を1履歴に記録する。
  function changeTitle(value) {
    if (!value.trim()) return;
    edit(() => { title.value = value.trim(); });
  }

  // 親IDを受け取り、子ノード追加を1履歴に記録する。
  function createNode(id) {
    edit(() => addNode(id));
  }

  // ノードIDとテキストを受け取り、編集を1履歴に記録する。
  function changeNode(id, text) {
    edit(() => updateNodeText(id, text));
  }

  // 履歴から取得したJSONを復元し、編集中の入力と表示位置をリセットする。
  function restore(value) {
    if (value === null) return;
    const data = JSON.parse(value);
    title.value = data.title;
    Object.assign(sheetState, parseSheet(data));
    version.value++;
    message.value = '';
  }

  // 現在のスナップショットからひとつ前の履歴へ移動する。
  function undo() {
    if (isBusy.value) return;
    restore(history.undo(snapshot()));
  }

  // 現在のスナップショットからひとつ先の履歴へ移動する。
  function redo() {
    if (isBusy.value) return;
    restore(history.redo(snapshot()));
  }

  // 非同期操作中の重複実行を防ぎ、失敗を画面へ通知する。
  async function run(operation) {
    if (isBusy.value) return;
    isBusy.value = true;
    notify('処理中…');
    try { await operation(); } catch (err) { notify(err.message, true); }
    finally { isBusy.value = false; }
  }

  // 未保存の編集がある場合だけ、切替前の確認を表示する。
  function requestSwitch(label, operation) {
    if (isBusy.value) return;
    if (hasChanges.value) {
      pendingAction.value = { label, operation };
      return;
    }
    operation();
  }

  // 未保存変更の破棄が選ばれた後で、保留していた操作を実行する。
  function confirmSwitch() {
    const action = pendingAction.value;
    pendingAction.value = null;
    action?.operation();
  }

  // シート切替の確認を閉じ、現在の編集を保持する。
  function cancelSwitch() {
    pendingAction.value = null;
  }

  // 検証済み本体を新しい編集対象にし、履歴を初期化する。
  function replaceSheet(body, metadata, id) {
    Object.assign(sheetState, body);
    title.value = metadata.title || '無題のシート';
    createdAt.value = metadata.created_at || new Date().toISOString();
    updatedAt.value = metadata.updated_at || createdAt.value;
    sheetId.value = id;
    savedSnapshot.value = id ? snapshot() : '';
    history.reset();
    version.value++;
    isListOpen.value = false;
  }

  // 未保存変更を確認し、新規シートをローカルで作成する。
  function newSheet() {
    requestSwitch('新規シートを作成', () => {
      replaceSheet(createEmptySheet(), { title: '無題のシート' }, null);
      notify('新規シートを作成しました。保存するとサーバーに登録されます。');
    });
  }

  // シート本体をサーバーへ保存し、成功後に保存基準と履歴を更新する。
  async function save() {
    await run(async () => {
      const body = parseSheet(sheetState);
      const current = snapshot();
      if (!sheetId.value) {
        const data = await api.createSheet(title.value);
        if (!data || typeof data.id !== 'string' || !data.id) throw new Error('新規シートIDを取得できませんでした。');
        sheetId.value = data.id;
      }
      const data = await api.saveSheet(sheetId.value, { title: title.value, ...body });
      updatedAt.value = data?.updated_at || new Date().toISOString();
      savedSnapshot.value = current;
      history.reset();
      notify('保存しました。');
    });
  }

  // 一覧パネルを開き、サーバーの保存済みシートを取得する。
  async function openList() {
    isListOpen.value = true;
    sheets.value = [];
    await run(async () => {
      const data = await api.getSheets();
      if (!Array.isArray(data) || data.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string')) {
        throw new Error('シート一覧の応答形式が不正です。');
      }
      sheets.value = data;
      notify(data.length ? '' : '保存済みシートはありません。');
    });
  }

  // シートIDを受け取り、未保存変更を確認後に取得・検証して切り替える。
  function loadSheet(id) {
    requestSwitch('シートを読み込む', () => run(async () => {
      const data = await api.getSheet(id);
      const body = parseSheet(data);
      const metadata = data.metadata || data;
      if (typeof metadata.title !== 'string') throw new Error('シートタイトルが不正です。');
      replaceSheet(body, metadata, id);
      notify('読み込みました。');
    }));
  }

  // 編集中の内容を自己完結したJSONファイルとしてダウンロードする。
  function exportSheet() {
    try {
      const data = { metadata: { title: title.value, created_at: createdAt.value,
        updated_at: hasChanges.value ? new Date().toISOString() : updatedAt.value }, ...parseSheet(sheetState) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${title.value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'sheet'}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('JSONをエクスポートしました。');
    } catch (err) { notify(err.message, true); }
  }

  // JSONファイルを検証してから、常に新規シートとして取り込む。
  async function importSheet(file) {
    if (!file) return;
    await run(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error('5MB以下のJSONファイルを選んでください。');
      const data = JSON.parse(await file.text());
      const body = parseSheet(data);
      if (!data.metadata || typeof data.metadata.title !== 'string') throw new Error('metadata.titleが必要です。');
      const metadata = { title: data.metadata.title };
      // 検証後に確認するため、現在のシートは失敗時にも保持される。
      const operation = () => {
        replaceSheet(body, metadata, null);
        notify('新規シートとしてインポートしました。保存でサーバーに登録できます。');
      };
      if (hasChanges.value) pendingAction.value = { label: 'JSONをインポート', operation };
      else operation();
    });
  }

  return { sheetState, title, sheetId, version, isBusy, message, hasError, hasChanges,
    sheets, isListOpen, pendingAction, canUndo: history.canUndo, canRedo: history.canRedo,
    changeTitle, createNode, changeNode, undo, redo, newSheet, save, openList,
    loadSheet, exportSheet, importSheet, confirmSwitch, cancelSwitch, notify };
}
