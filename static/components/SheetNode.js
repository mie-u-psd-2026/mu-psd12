// ノードを表示し、編集結果を親へ通知する。
import { ref, watch, nextTick } from 'vue';

// コンポーネントの識別名。
const name = 'SheetNode';
// ノード本体と描画位置、編集状態。
const props = {
  node: { type: Object, required: true },
  position: { type: Object, required: true },
  isEditing: { type: Boolean, default: false },
};
// 選択と編集終了の通知。
const emits = ['selected', 'textCommitted', 'editCancelled'];

// 編集用の文字列と、確定・キャンセルのハンドラを返す。
function setup(props, { emit }) {
  const draft = ref('');
  const editor = ref(null);
  watch(() => props.isEditing, async isEditing => {
    if (!isEditing) return;

    draft.value = props.node.text;
    await nextTick();
    editor.value?.focus();
    editor.value?.select();
  }, { immediate: true });

  // 入力中の文字列を親へ送り、編集を終了する。
  function handleCommit() {
    if (!props.isEditing) return;

    emit('textCommitted', props.node.id, draft.value);
  }

  // キー入力を受け取り、変換中以外のEnterで確定、Escapeで取消する。
  function handleKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCommit();
      return;
    }
    if (event.key === 'Escape') emit('editCancelled');
  }

  // ノードの選択を親へ通知する。
  function handleSelect() {
    emit('selected', props.node.id);
  }

  return { draft, editor, handleCommit, handleKeydown, handleSelect };
}

// ボタン表示と編集用入力欄を切り替える。
const template = `
  <div class="sheet-node" :class="{ 'theme-node': node.kind === 'theme' }"
    :style="{ left: position.x + 'px', top: position.y + 'px' }">
    <input v-if="isEditing" ref="editor" v-model="draft" class="node-editor"
      aria-label="ノードのテキスト" @blur="handleCommit" @keydown="handleKeydown"
      @pointerdown.stop @wheel.stop>
    <button v-else type="button" class="node-button" @click.stop="handleSelect">{{ node.text }}</button>
  </div>
`;

export default { name, props, emits, setup, template };
