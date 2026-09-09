// 接続・グループの簡易編集パネル。
import { ref, onMounted } from 'vue';
import { GROUP_COLORS } from '../utils/sheet_format.js';
// コンポーネントの識別名。
const name = 'EditPanel';
// 表示位置と編集対象。
const props = { heading: { type: String, default: 'Edit' }, hasTitle: Boolean, title: { type: String, default: '' },
  comment: { type: String, default: '' }, color: { type: String, default: '#d4e4f7' },
  canDelete: Boolean, x: { type: Number, default: 160 }, y: { type: Number, default: 160 } };
// 確定・削除・閉じる操作。
const emits = ['save', 'delete', 'close'];
// 入力用のコピーを持ち、確定するまではシートを変更しない。
function setup(props, { emit }) {
  const draftTitle = ref(props.title);
  const draftComment = ref(props.comment);
  const draftColor = ref(props.color);
  const panel = ref(null);
  const colors = GROUP_COLORS;
  onMounted(() => panel.value?.querySelector('input, textarea')?.focus());
  // 有効な入力だけを親へ通知する。
  function handleSave() {
    if (props.hasTitle && !draftTitle.value.trim()) return;
    emit('save', draftTitle.value.trim(), draftComment.value, draftColor.value);
  }
  // 対象の削除を親へ通知する。
  function handleDelete() { emit('delete'); }
  // 変更を確定せずに閉じる。
  function handleClose() { emit('close'); }
  // 選択したパステル色を入力値へ反映する。
  function handleColor(value) { draftColor.value = value; }
  return { panel, draftTitle, draftComment, draftColor, colors, handleSave, handleDelete, handleClose, handleColor };
}
// 画面内に収まる位置でアプリ内編集を表示する。
const template = `<form ref="panel" class="edit-panel" :style="{ left: x + 'px', top: y + 'px' }"
  :aria-label="heading" @submit.prevent="handleSave" @keydown.esc.stop="handleClose" @pointerdown.stop>
  <h2>{{ heading }}</h2>
  <label v-if="hasTitle">Title<input v-model="draftTitle" required></label>
  <label>Comment<textarea v-model="draftComment" rows="3"></textarea></label>
  <div v-if="hasTitle" class="color-options" aria-label="Group Color">
    <button v-for="(color, index) in colors" :key="color" type="button" :aria-label="'Group Color ' + (index + 1)"
      :aria-pressed="draftColor === color" :style="{ backgroundColor: color }" @click="handleColor(color)"></button>
  </div>
  <div class="edit-actions"><button type="button" class="text-button" @click="handleClose">Cancel</button>
    <button v-if="canDelete" type="button" class="text-button" @click="handleDelete">Delete</button>
    <button type="submit" class="text-button" :disabled="hasTitle && !draftTitle.trim()">Submit</button></div>
</form>`;
export default { name, props, emits, setup, template };
