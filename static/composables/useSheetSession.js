// シート編集、履歴、ファイル入出力、サーバー保存の共有状態。
import { computed, ref } from 'vue';
import { useSheetState } from './useSheetState.js';
import { useUndoRedo } from './useUndoRedo.js';
import { useApiClient } from './useApiClient.js';
import { createEmptySheet, parseSheet } from '../utils/sheet_format.js';
import { removeNode, addLink, addGroup, moveToGroup, detachMembers } from '../utils/sheet_operations.js';
import { prepareProposal } from '../utils/ai_proposal.js';

// 画面から呼び出すシート操作と表示状態を返す。
export function useSheetSession() {
  const { sheetState, addNode, updateNodeText } = useSheetState();
  const history = useUndoRedo();
  const api = useApiClient();
  const title = ref('Untitled Sheet');
  const sheetId = ref(null);
  const createdAt = ref(new Date().toISOString());
  const updatedAt = ref(createdAt.value);
  const version = ref(0);
  const isBusy = ref(false);
  const message = ref('');
  const hasError = ref(false);
  const proposal = ref(null);
  const isLocked = computed(() => isBusy.value || !!proposal.value);
  let proposalBase = '';
  let proposalSheet = null;
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
    if (isLocked.value) return false;
    const before = snapshot();
    try {
      operation();
      Object.assign(sheetState, parseSheet(sheetState));
      history.record(before, snapshot());
      notify('');
      return true;
    } catch (err) {
      const original = JSON.parse(before);
      title.value = original.title;
      Object.assign(sheetState, parseSheet(original));
      notify(err.message, true);
      return false;
    }
  }

  // ノードを削除し、子と参照を安全に整理する。
  function deleteNode(id) { return edit(() => removeNode(sheetState, id)); }
  // 無向エッジを作成する。コメントは必須。
  function createLink(a, b, comment) { return edit(() => addLink(sheetState, a, b, comment)); }
  // エッジのコメントを更新する。
  function changeLink(id, comment) {
    return edit(() => {
      const link = sheetState.links.find(entry => entry.id === id);
      if (!link) throw new Error('The target link does not exist.');
      link.comment = comment;
    });
  }
  // エッジを削除する。
  function deleteLink(id) { return edit(() => { sheetState.links = sheetState.links.filter(link => link.id !== id); }); }
  // 新規グループを作成する。
  function createGroup(members, name, comment, color) { return edit(() => addGroup(sheetState, members, name, comment, color)); }
  // 既存グループへノードを移す。
  function assignGroup(id, groupId) { return edit(() => moveToGroup(sheetState, id, groupId)); }
  // グループからノードを除外する。
  function excludeGroup(id) { return edit(() => detachMembers(sheetState, [id])); }
  // グループのタイトル、コメント、色を更新する。
  function changeGroup(id, name, comment, color) {
    return edit(() => {
      const group = sheetState.groups.find(entry => entry.id === id);
      if (!group || !name.trim()) throw new Error('Please enter a group name.');
      Object.assign(group, { title: name.trim(), comment, color });
    });
  }
  // メンバーノードを保持したままグループを削除する。
  function deleteGroup(id) { return edit(() => { sheetState.groups = sheetState.groups.filter(group => group.id !== id); }); }
  // ノートを新規作成または更新する。
  function saveNote(id, name, body) {
    return edit(() => {
      if (!name.trim()) throw new Error('Please enter a note title.');
      if (!id) { sheetState.notes.push({ id: crypto.randomUUID(), title: name.trim(), body }); return; }
      const note = sheetState.notes.find(entry => entry.id === id);
      if (!note) throw new Error('The target note does not exist.');
      Object.assign(note, { title: name.trim(), body });
    });
  }
  // ノートを削除する。
  function deleteNote(id) { return edit(() => { sheetState.notes = sheetState.notes.filter(note => note.id !== id); }); }


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
    if (isLocked.value) return;
    restore(history.undo(snapshot()));
  }

  // 現在のスナップショットからひとつ先の履歴へ移動する。
  function redo() {
    if (isLocked.value) return;
    restore(history.redo(snapshot()));
  }

  // 非同期操作中の重複実行を防ぎ、失敗を画面へ通知する。
  async function run(operation) {
    if (isLocked.value) return;
    isBusy.value = true;
    notify('Processing…');
    try { await operation(); return true; } catch (err) { notify(err.message, true); return false; }
    finally { isBusy.value = false; }
  }

  // 未保存の編集がある場合だけ、切替前の確認を表示する。
  function requestSwitch(label, operation) {
    if (isLocked.value) return;
    if (hasChanges.value) {
      pendingAction.value = { label, operation };
      return;
    }
    return operation();
  }

  // 未保存変更の破棄が選ばれた後で、保留していた操作を実行する。
  function confirmSwitch() {
    const action = pendingAction.value;
    pendingAction.value = null;
    return action?.operation();
  }

  // シート切替の確認を閉じ、現在の編集を保持する。
  function cancelSwitch() {
    pendingAction.value = null;
  }

  // 検証済み本体を新しい編集対象にし、履歴を初期化する。
  function replaceSheet(body, metadata, id) {
    Object.assign(sheetState, body);
    title.value = metadata.title || 'Untitled Sheet';
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
    requestSwitch('Create New Sheet', () => {
      replaceSheet(createEmptySheet(), { title: 'Untitled Sheet' }, null);
      notify('Created a new sheet. It will be registered on the server once saved.');
    });
  }

  // シートの保存成功後、手動・自動を問わず履歴をリセットする。
  async function persist() {
    const body = parseSheet(sheetState);
    const current = snapshot();
    if (!sheetId.value) {
      const data = await api.createSheet(title.value);
      if (!data || typeof data.id !== 'string' || !data.id) throw new Error('Failed to obtain a new sheet ID.');
      sheetId.value = data.id;
    }
    const data = await api.saveSheet(sheetId.value, { title: title.value, ...body });
    updatedAt.value = data?.updated_at || new Date().toISOString();
    savedSnapshot.value = current;
    history.reset();
    await api.updateState({ last_opened_sheet_id: sheetId.value });
  }

  // シートを保存し、成功を通知する。
  async function save() {
    return run(async () => { await persist(); notify('Saved.'); });
  }

  // 自動保存の成功後にAIを呼び、検証済みの提案を未確定の状態で表示する。
  async function requestAi(request) {
    if (!request.model_name) { notify('Please select an AI model.', true); return false; }
    return run(async () => {
      if (typeof request.target_node_id !== 'string') throw new Error('An AI target node ID is required. Use an empty string to target the whole sheet.');
      if (request.target_node_id !== '' && !sheetState.nodes.some(node => node.id === request.target_node_id)) {
        throw new Error('The AI target node does not exist.');
      }
      await persist();
      // ひとりごとの本文はtext、利用プロンプトはsystem_promptで渡す。
      const data = await api.requestAi({ ...request, sheet_id: sheetId.value });
      const prepared = prepareProposal(sheetState, data);
      proposalBase = snapshot();
      proposalSheet = sheetId.value;
      proposal.value = prepared;
      notify('Review the dashed changes, then approve or reject them all at once.');
    });
  }

  // 提案の基準シートを確認し、一括変更を1履歴として適用する。
  function commitProposal() {
    if (isBusy.value || !proposal.value) return false;
    if (proposalBase !== snapshot() || proposalSheet !== sheetId.value) {
      proposal.value = null;
      notify('The sheet changed after the proposal was made. Please call AI again.', true);
      return false;
    }
    const result = proposal.value.result;
    proposal.value = null;
    const success = edit(() => Object.assign(sheetState, parseSheet(result)));
    if (success) notify('Applied the AI proposal. You can undo it.');
    return success;
  }

  // 未確定の提案だけを破棄し、シートには変更を加えない。
  function rejectProposal() {
    proposal.value = null;
    notify('Rejected the AI proposal.');
  }

  // 一覧パネルを開き、サーバーの保存済みシートを取得する。
  async function openList() {
    isListOpen.value = true;
    sheets.value = [];
    await run(async () => {
      const data = await api.getSheets();
      if (!Array.isArray(data) || data.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string')) {
        throw new Error('The sheet list response format is invalid.');
      }
      sheets.value = data;
      notify(data.length ? '' : 'No saved sheets.');
    });
  }

  // シートIDを受け取り、未保存変更を確認後に取得・検証して切り替える。
  function loadSheet(id) {
    return requestSwitch('Load Sheet', () => run(async () => {
      const data = await api.getSheet(id);
      const body = parseSheet(data);
      const metadata = data;
      if (typeof metadata.title !== 'string') throw new Error('The sheet title is invalid.');
      // GET /sheet はバックエンド側で最後に開いたシートを更新する。
      replaceSheet(body, metadata, id);
      notify('Loaded.');
    }));
  }

  // 保存済みシートを確認後に削除する。現在の編集対象なら新規状態へ戻す。
  function deleteSheet(id) {
    if (isLocked.value) return;
    pendingAction.value = { label: 'Delete Saved Sheet', title: 'Delete this sheet?',
      message: 'This will delete it from the server. This action cannot be undone.', operation: () => run(async () => {
        await api.deleteSheet(id);
        sheets.value = sheets.value.filter(sheet => sheet.id !== id);
        if (sheetId.value === id) replaceSheet(createEmptySheet(), { title: 'Untitled Sheet' }, null);
        await api.updateState({ last_opened_sheet_id: sheetId.value });
        notify('Deleted the sheet.');
      }) };
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
      notify('Exported the JSON.');
    } catch (err) { notify(err.message, true); }
  }

  // JSONファイルを検証してから、常に新規シートとして取り込む。
  async function importSheet(file) {
    if (!file) return;
    await run(async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error('Please choose a JSON file 5MB or smaller.');
      const data = JSON.parse(await file.text());
      const body = parseSheet(data);
      if (!data.metadata || typeof data.metadata.title !== 'string') throw new Error('metadata.title is required.');
      const metadata = { title: data.metadata.title };
      // 検証後に確認するため、現在のシートは失敗時にも保持される。
      const operation = () => {
        replaceSheet(body, metadata, null);
        notify('Imported as a new sheet. Save it to register on the server.');
      };
      if (hasChanges.value) pendingAction.value = { label: 'Import JSON', operation };
      else operation();
    });
  }

  return { sheetState, title, sheetId, version, isBusy, isLocked, proposal, message, hasError, hasChanges,
    sheets, isListOpen, pendingAction, canUndo: history.canUndo, canRedo: history.canRedo,
    changeTitle, createNode, changeNode, deleteNode, createLink, changeLink, deleteLink, createGroup, assignGroup, excludeGroup,
    changeGroup, deleteGroup, saveNote, deleteNote, requestAi, commitProposal, rejectProposal,
    undo, redo, newSheet, save, openList, deleteSheet,
    loadSheet, exportSheet, importSheet, confirmSwitch, cancelSwitch, notify };
}
