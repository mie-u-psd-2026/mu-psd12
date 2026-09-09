// ひとりごとメモの入力欄と送信操作。
import { ref } from 'vue';
import AppIcon from './AppIcon.js';
// コンポーネントの識別名。
const name = 'MutterInput';
// AI処理が利用可能かどうか。
const props = { canSubmit: { type: Boolean, default: false }, isBusy: Boolean };
// 入力内容を親へ通知するイベント。
const emits = ['submit'];
// 入力中のメモと送信ハンドラを返す。
function setup(props, { emit }) {
  const text = ref('');
  // 空欄と利用不可を除き、入力文を親へ通知する。
  function handleSubmit() {
    if (!props.canSubmit || props.isBusy || !text.value.trim()) return;
    emit('submit', text.value.trim());
  }
  return { text, handleSubmit };
}
// シート左下の常設入力欄。
const template = `<form class="mutter-input ai-accent" @submit.prevent="handleSubmit">
  <label for="mutter-text">Mutter Memo</label>
  <textarea id="mutter-text" v-model="text" :disabled="isBusy" placeholder="Jot down an idea…" rows="2"></textarea>
  <div class="mutter-footer"><small v-if="!canSubmit">Select model to submit.</small>
    <button type="submit" class="icon-button" aria-label="Send memo to AI" :disabled="!canSubmit || isBusy || !text.trim()"><app-icon icon="send" label="Send"></app-icon></button></div>
</form>`;
export default { name, props, emits, components: { AppIcon }, setup, template };
