// 保存済みシートの一覧と読込操作を表示する。
import AppIcon from './AppIcon.js';
// コンポーネントの識別名。
const name = 'SheetListPanel';
// 一覧内容と読み込み状態。
const props = { sheets: { type: Array, default: () => [] }, isBusy: Boolean, hasError: Boolean };
// 一覧から選ばれた操作。
const emits = ['select', 'createNew', 'close', 'retry', 'delete'];

// 日付表示とボタンの通知ハンドラを返す。
function setup(props, { emit }) {
  // 更新日時を受け取り、日本語表示または未取得表示を返す。
  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '更新日時なし' : date.toLocaleString('ja-JP');
  }
  // 選択されたシートIDを親へ通知する。
  function handleSelect(id) { emit('select', id); }
  // 新規作成を親へ通知する。
  function handleCreate() { emit('createNew'); }
  // 一覧を閉じる操作を親へ通知する。
  function handleClose() { emit('close'); }
  // 再取得を親へ通知する。
  function handleRetry() { emit('retry'); }
  // 保存済みシートの削除を要求する。
  function handleDelete(id) { emit('delete', id); }
  return { handleDelete, formatDate, handleSelect, handleCreate, handleClose, handleRetry };
}
// フォーカス移動でも利用できるシート一覧。
const template = `
  <section class="sheet-list" aria-label="保存済みシート" @keydown.esc.stop="handleClose">
    <div class="panel-heading"><h2>保存済みシート</h2>
      <button type="button" class="icon-button" aria-label="一覧を閉じる" @click="handleClose"><app-icon icon="x" label="閉じる"></app-icon></button></div>
    <p v-if="isBusy">読み込み中…</p>
    <p v-else-if="hasError">一覧を取得できませんでした。<button type="button" class="text-button" @click="handleRetry">再試行</button></p>
    <p v-else-if="!sheets.length">保存済みシートはありません。</p>
    <ul v-else><li v-for="sheet in sheets" :key="sheet.id">
      <button type="button" class="sheet-list-entry" :disabled="isBusy" @click="handleSelect(sheet.id)">
        <strong>{{ sheet.title }}</strong><time>{{ formatDate(sheet.updated_at) }}</time>
      </button><button type="button" class="icon-button" :aria-label="'シートを削除：' + sheet.title" :disabled="isBusy" @click="handleDelete(sheet.id)"><app-icon icon="trash-2" label="削除"></app-icon></button></li></ul>
    <button type="button" class="text-button" :disabled="isBusy" @click="handleCreate">新規シートを作成</button>
  </section>`;
export default { name, props, emits, components: { AppIcon }, setup, template };
