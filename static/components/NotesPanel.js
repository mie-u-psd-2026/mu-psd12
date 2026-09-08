// ノート一覧と、新規・編集・削除の操作。
import AppIcon from './AppIcon.js';
// コンポーネントの識別名。
const name = 'NotesPanel';
// ノート一覧と操作ロック。
const props = { notes: { type: Array, default: () => [] }, isLocked: Boolean };
// ノートの操作要求。
const emits = ['create', 'edit', 'delete'];
// ボタンのイベントを親へ通知するハンドラを返す。
function setup(props, { emit }) {
  // 新規作成を要求する。
  function handleCreate() { emit('create'); }
  // ノート編集を要求する。
  function handleEdit(note) { emit('edit', note); }
  // ノート削除を要求する。
  function handleDelete(id) { emit('delete', id); }
  return { handleCreate, handleEdit, handleDelete };
}
// 本文を展開して読めるノート一覧。
const template = `<section class="notes-panel" aria-label="ノート"><div class="panel-heading"><h2>ノート</h2>
  <button type="button" class="icon-button" aria-label="ノートを追加" :disabled="isLocked" @click="handleCreate"><app-icon icon="plus" label="追加"></app-icon></button></div>
  <p v-if="!notes.length" class="muted">ノートはまだありません</p>
  <details v-for="note in notes" :key="note.id"><summary>{{ note.title }}</summary><p class="note-body">{{ note.body }}</p>
    <button type="button" class="icon-button" :aria-label="'ノートを編集：' + note.title" :disabled="isLocked" @click="handleEdit(note)"><app-icon icon="edit-3" label="編集"></app-icon></button>
    <button type="button" class="icon-button" :aria-label="'ノートを削除：' + note.title" :disabled="isLocked" @click="handleDelete(note.id)"><app-icon icon="trash-2" label="削除"></app-icon></button>
  </details></section>`;
export default { name, props, emits, components: { AppIcon }, setup, template };
