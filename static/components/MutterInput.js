// ひとりごとメモの入力欄と送信操作。
import { ref } from 'vue';
import AppIcon from './AppIcon.js';
// コンポーネントの識別名。
const name = 'MutterInput';
// AI処理が利用可能かどうか。
const props = { canSubmit: { type: Boolean, default: false } };
// 入力内容を親へ通知するイベント。
const emits = ['submit'];
// 入力中のメモと送信ハンドラを返す。
function setup(props, { emit }) {
  const text = ref('');
  // 空欄と利用不可を除き、入力文を親へ通知する。
  function handleSubmit() {
    if (!props.canSubmit || !text.value.trim()) return;
    emit('submit', text.value.trim());
  }
  return { text, handleSubmit };
}
// シート左下の常設入力欄。
const template = `<form class="mutter-input ai-accent" @submit.prevent="handleSubmit">
  <label for="mutter-text">ひとりごとメモ</label>
  <textarea id="mutter-text" v-model="text" placeholder="浮かんだアイデアをここに…" rows="2"></textarea>
  <div class="mutter-footer"><small v-if="!canSubmit">AI連携は準備中</small>
    <button type="submit" class="icon-button" aria-label="メモをAIに送信" :disabled="!canSubmit || !text.trim()"><app-icon icon="send" label="送信"></app-icon></button></div>
</form>`;
export default { name, props, emits, components: { AppIcon }, setup, template };
