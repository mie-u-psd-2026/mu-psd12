// 接続・グループ・ノートの編集パネルとグループ選択を管理する。
import { ref, watch } from 'vue';
import { GROUP_COLORS } from '../utils/sheet_format.js';

// シート操作と汎用ホイールを受け取り、編集用の状態とハンドラを返す。
export function useEditorPanels(session, wheel) {
  const editPanel = ref(null);
  const noteEditor = ref(null);
  let groupTarget;
  let groupPoint;
  let groupPage = 0;

  // イベントから、編集パネルが収まる画面内座標を返す。
  function panelPoint(event) {
    const bounds = event.currentTarget?.getBoundingClientRect();
    return { x: Math.max(16, Math.min(window.innerWidth - 352, event.clientX || bounds?.left || 160)),
      y: Math.max(16, Math.min(window.innerHeight - 400, event.clientY || bounds?.top || 160)) };
  }

  // 編集パネルを閉じる。
  function closeEdit() { editPanel.value = null; }
  // ノート編集を閉じる。
  function closeNote() { noteEditor.value = null; }
  // パネルを全て閉じる。
  function closeAll() { closeEdit(); closeNote(); wheel.close(); }
  watch(session.version, closeAll);

  // 接続またはグループを受け取り、編集用コピーを表示する。
  function openEdit(kind, item, event) {
    if (session.isLocked.value) return;
    editPanel.value = { kind, item: { ...item }, ...panelPoint(event) };
  }

  // 現在ページの既存グループ、新規作成、除外をホイールに表示する。
  function showGroups() {
    const groups = session.sheetState.groups;
    const start = groupPage * 4;
    const entries = groups.slice(start, start + 4).map(group => ({ value: 'group:' + group.id, label: group.title, color: group.color }));
    entries.push({ value: 'create', label: 'New Group', icon: 'plus' });
    if (groups.some(group => group.members.includes(groupTarget))) entries.push({ value: 'exclude', label: 'Remove from Group', icon: 'minus' });
    if (groupPage > 0) entries.push({ value: 'previous', label: 'Previous Group', icon: 'chevron-left' });
    if (start + 4 < groups.length) entries.push({ value: 'next', label: 'Next Group', icon: 'chevron-right' });
    wheel.close();
    wheel.isKeyboard.value = true;
    wheel.open('group', entries, groupPoint);
  }

  // 対象ノードと位置を受け取り、グループ選択を開く。
  function openGroups(id, event) {
    if (session.isLocked.value) return;
    groupTarget = id;
    groupPoint = panelPoint(event);
    groupPage = 0;
    showGroups();
  }

  // グループホイールの選択を所属変更または新規作成へ反映する。
  function selectGroup(value) {
    if (!session.sheetState.nodes.some(node => node.id === groupTarget)) return;
    if (value === 'next' || value === 'previous') { groupPage += value === 'next' ? 1 : -1; showGroups(); return; }
    if (value === 'create') {
      editPanel.value = { kind: 'newGroup', item: { title: '', comment: '', members: [groupTarget],
        color: GROUP_COLORS[session.sheetState.groups.length % GROUP_COLORS.length] }, ...groupPoint };
      return;
    }
    if (value === 'exclude') session.excludeGroup(groupTarget);
    if (value.startsWith('group:')) session.assignGroup(groupTarget, value.slice(6));
  }

  // パネル入力を適切なシート操作へ渡し、成功時だけ閉じる。
  function saveEdit(title, comment, color) {
    const panel = editPanel.value;
    if (!panel) return;
    let success;
    if (panel.kind === 'group') success = session.changeGroup(panel.item.id, title, comment, color);
    if (panel.kind === 'newGroup') success = session.createGroup(panel.item.members, title, comment, color);
    if (success) closeEdit();
  }

  // パネルが示す接続またはグループを削除する。
  function deleteEdit() {
    const panel = editPanel.value;
    if (!panel) return;
    if (panel.kind === 'group') session.deleteGroup(panel.item.id);
    closeEdit();
  }

  // ノートを入力用コピーとして開く。未指定は新規作成。
  function openNote(note = null) { if (!session.isLocked.value) noteEditor.value = { note: note ? { ...note } : null }; }
  // ノートの入力結果を保存し、成功時だけ閉じる。
  function saveNote(id, title, body) { if (session.saveNote(id, title, body)) closeNote(); }
  return { editPanel, noteEditor, openEdit, openGroups, selectGroup, saveEdit, deleteEdit,
    closeEdit, openNote, saveNote, closeNote, closeAll };
}
