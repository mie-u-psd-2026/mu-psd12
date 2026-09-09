// 未保存の編集を置き換える前のアプリ内確認。
import { ref, onMounted, onBeforeUnmount } from 'vue';
// コンポーネントの識別名。
const name = 'DiscardPanel';
// 続行する操作の名前。
const props = { label: { type: String, required: true }, title: { type: String, default: 'You have unsaved changes' },
  message: { type: String, default: '' } };
// 続行とキャンセル。
const emits = ['confirm', 'cancel'];
// 初期フォーカスと、確認のハンドラを返す。
function setup(props, { emit }) {
  const dialog = ref(null);
  let previousFocus;
  onMounted(() => { previousFocus = document.activeElement; dialog.value?.querySelector('button')?.focus(); });
  onBeforeUnmount(() => previousFocus?.focus());
  // 編集を保持して確認を閉じる。
  function handleCancel() { emit('cancel'); }
  // 編集の破棄と操作の続行を親へ通知する。
  function handleConfirm() { emit('confirm'); }
  // Tabのフォーカス移動を確認内で巡回させる。
  function handleKeydown(event) {
    if (event.key === 'Escape') { handleCancel(); return; }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const buttons = [...dialog.value.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
  }
  return { dialog, handleCancel, handleConfirm, handleKeydown };
}
// ネイティブダイアログを使わない確認表示。
const template = `<div class="dialog-backdrop"><section ref="dialog" class="discard-panel"
  role="dialog" aria-modal="true" aria-labelledby="discard-title" @keydown="handleKeydown">
  <h2 id="discard-title">{{ title }}</h2><p>{{ message || 'Discard changes and continue with "' + label + '"?' }}</p>
  <div class="dialog-actions"><button type="button" class="text-button" @click="handleCancel">Cancel</button>
    <button type="button" class="text-button" @click="handleConfirm">Continue</button></div>
</section></div>`;
export default { name, props, emits, setup, template };
