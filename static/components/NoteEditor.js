// ノートの新規作成と編集を、入力用コピーで行う。
import { ref, onMounted } from 'vue';
// コンポーネントの識別名。
const name = 'NoteEditor';
// 編集対象のノート。未指定なら新規作成。
const props = { note: Object };
// 保存とキャンセル。
const emits = ['save', 'close'];
// 入力値と確定ハンドラを返す。
function setup(props, { emit }) {
  const title = ref(props.note?.title || '');
  const body = ref(props.note?.body || '');
  const input = ref(null);
  onMounted(() => input.value?.focus());
  // 入力したタイトルと本文を親へ通知する。
  function handleSave() { if (title.value.trim()) emit('save', props.note?.id || null, title.value.trim(), body.value); }
  // 編集を取り消して閉じる。
  function handleClose() { emit('close'); }
  return { title, body, input, handleSave, handleClose };
}
// 本文の改行と任意の文字列を、そのままテキストとして編集する。
const template = `<form class="note-editor" aria-label="Edit Note" @submit.prevent="handleSave" @keydown.esc.stop="handleClose">
  <h2>{{ note ? 'Edit Note' : 'Create Note' }}</h2>
  <label>Title<input ref="input" v-model="title" required></label>
  <label>Body<textarea v-model="body" rows="8"></textarea></label>
  <div class="edit-actions"><button type="button" class="text-button" @click="handleClose">Cancel</button>
    <button type="submit" class="text-button" :disabled="!title.trim()">Save</button></div>
</form>`;
export default { name, props, emits, setup, template };
