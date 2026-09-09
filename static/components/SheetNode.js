// ノードの描画、インライン編集、600ms長押し削除を扱う。
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
// コンポーネントの識別名。
const name = 'SheetNode';
// 表示データと操作・提案状態。
const props = { node: { type: Object, required: true }, position: { type: Object, required: true },
  isEditing: Boolean, canRemove: Boolean, isSelected: Boolean, isChanged: Boolean, isRemoved: Boolean, isLocked: Boolean };
// ノードの操作結果と実測サイズ。
const emits = ['selected', 'textCommitted', 'editCancelled', 'removeRequested', 'holdingChanged', 'sizeChanged'];
// 編集・長押しの一時状態とハンドラを返す。
function setup(props, { emit }) {
  const draft = ref('');
  const editor = ref(null);
  const element = ref(null);
  const isHolding = ref(false);
  let timer;
  let observer;
  let origin;
  let hasEnded = false;
  watch(() => props.isEditing, async value => {
    if (!value) return;
    hasEnded = false;
    draft.value = props.node.text;
    await nextTick();
    editor.value?.focus();
    editor.value?.select();
  }, { immediate: true });
  watch(() => [props.canRemove, props.isLocked], () => { if (!props.canRemove || props.isLocked) handleCancelHold(); });

  // 編集を一度だけ確定し、親へテキストを渡す。
  function handleCommit() {
    if (!props.isEditing || hasEnded) return;
    hasEnded = true;
    emit('textCommitted', props.node.id, draft.value);
  }
  // 日本語変換を妨げずにEnterで確定、Escapeで取消する。
  function handleKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') { event.preventDefault(); handleCommit(); }
    if (event.key === 'Escape') { hasEnded = true; emit('editCancelled'); }
  }
  // 選択されたノードとクリック位置を親へ通知する。
  function handleSelect(event) {
    if (props.isLocked) return;
    emit('selected', props.node.id, event);
  }
  // 左長押しを開始し、600ms継続した場合だけ削除を要求する。
  function handleHold(event) {
    if (!props.canRemove || props.isLocked || event.button !== 0) return;
    event.preventDefault();
    handleCancelHold();
    origin = { x: event.clientX, y: event.clientY };
    isHolding.value = true;
    emit('holdingChanged', true);
    timer = setTimeout(() => {
      if (!isHolding.value) return;
      handleCancelHold();
      emit('removeRequested', props.node.id);
    }, 600);
  }
  // マウス移動で長押しが取り消されるよう開始位置と比較する。
  function handleMove(event) {
    if (isHolding.value && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) handleCancelHold();
  }
  // ボタン解除、領域外移動、フォーカス喪失時に長押しを取り消す。
  function handleCancelHold() {
    clearTimeout(timer);
    if (!isHolding.value) return;
    isHolding.value = false;
    emit('holdingChanged', false);
  }
  // Escapeでも削除の長押しを取り消す。
  function handleCancelKey(event) { if (event.key === 'Escape') handleCancelHold(); }
  onMounted(() => {
    window.addEventListener('keydown', handleCancelKey);
    window.addEventListener('pointerup', handleCancelHold);
    window.addEventListener('pointercancel', handleCancelHold);
    window.addEventListener('blur', handleCancelHold);
    if (typeof ResizeObserver === 'undefined') return;
    observer = new ResizeObserver(() => emit('sizeChanged', props.node.id,
      { width: element.value.offsetWidth, height: element.value.offsetHeight }));
    observer.observe(element.value);
  });
  onBeforeUnmount(() => {
    handleCancelHold();
    observer?.disconnect();
    window.removeEventListener('keydown', handleCancelKey);
    window.removeEventListener('pointerup', handleCancelHold);
    window.removeEventListener('pointercancel', handleCancelHold);
    window.removeEventListener('blur', handleCancelHold);
  });
  return { draft, editor, element, isHolding, handleCommit, handleKeydown, handleSelect, handleHold, handleMove, handleCancelHold };
}
// 提案は破線、削除予定は取り消し線、長押しは進捗で区別する。
const template = `<div ref="element" class="sheet-node" :data-node-id="node.id"
  :class="{ 'theme-node': node.kind === 'theme', 'is-selected': isSelected, 'ai-proposed': isChanged,
    'is-removed': isRemoved, 'is-holding': isHolding }"
  :style="{ left: position.x + 'px', top: position.y + 'px' }">
  <input v-if="isEditing" ref="editor" v-model="draft" class="node-editor" aria-label="Node text"
    @blur="handleCommit" @keydown="handleKeydown" @pointerdown.stop @wheel.stop>
  <button v-else type="button" class="node-button" :aria-pressed="isSelected" :aria-disabled="isLocked"
    @click.stop="handleSelect" @pointerdown="handleHold" @pointermove="handleMove" @pointerleave="handleCancelHold">{{ node.text }}</button>
</div>`;
export default { name, props, emits, setup, template };
