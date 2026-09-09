// 接続の線・中点のコメント表示・インライン編集を扱う。
import { ref, computed, watch, nextTick } from 'vue';
// コンポーネントの識別名。
const name = 'SheetEdge';
// 接続の座標、種別、編集状態。isNewは未作成の新規接続を表す。
const props = { from: { type: Object, required: true }, to: { type: Object, required: true },
  type: { type: String, default: 'direct' }, link: Object, canEdit: Boolean, isNew: Boolean,
  isChanged: Boolean, isRemoved: Boolean };
// コメント確定（新規作成 or 既存更新）、編集取消、削除の通知。
const emits = ['commit', 'cancelled', 'deleteRequested'];
// インライン編集の一時状態とハンドラを返す。
function setup(props, { emit }) {
  const draft = ref('');
  const editor = ref(null);
  const isEditing = ref(false);
  let hasEnded = false;
  // 中点座標。コメントの表示・入力欄の位置に使う。
  const mid = computed(() => ({ x: (props.from.x + props.to.x) / 2, y: (props.from.y + props.to.y) / 2 }));

  // 編集を開始し、入力欄へフォーカスする。
  async function startEdit(initial) {
    hasEnded = false;
    draft.value = initial;
    isEditing.value = true;
    await nextTick();
    editor.value?.focus();
    editor.value?.select();
  }
  // 新規接続は作成直後から編集状態で始める。
  watch(() => props.isNew, value => { if (value) startEdit(''); }, { immediate: true });
  // 編集不可になった場合（モード切替・ロック）、未確定の編集を破棄する。
  watch(() => props.canEdit, value => { if (!value && isEditing.value && !props.isNew) isEditing.value = false; });

  // 既存接続のクリックで編集を開始する。
  function handleStart() { if (props.canEdit && !props.isNew) startEdit(props.link?.comment || ''); }
  // コメントを一度だけ確定する。空欄なら新規は取消、既存は元の値を維持する。
  function handleCommit() {
    if (!isEditing.value || hasEnded) return;
    hasEnded = true;
    isEditing.value = false;
    const text = draft.value.trim();
    if (!text) { emit('cancelled'); return; }
    emit('commit', props.link ? props.link.id : null, text);
  }
  // 日本語変換を妨げずにEnterで確定、Escapeで取消する。
  function handleKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') { event.preventDefault(); handleCommit(); }
    if (event.key === 'Escape') { hasEnded = true; isEditing.value = false; emit('cancelled'); }
  }
  // 編集中の既存接続を削除する。
  function handleDelete() { hasEnded = true; isEditing.value = false; emit('deleteRequested', props.link.id); }
  return { draft, editor, isEditing, mid, handleStart, handleCommit, handleKeydown, handleDelete };
}
// 線本体・広いクリック領域・中点のコメント表示/入力欄を重ねる。
const template = `<g v-if="from && to">
  <line :x1="from.x" :y1="from.y" :x2="to.x" :y2="to.y" class="sheet-edge"
    :class="{ 'is-indirect': type === 'indirect', 'ai-edge': isChanged || isRemoved, 'is-removed': isRemoved }" />
  <line v-if="canEdit && !isEditing" :x1="from.x" :y1="from.y" :x2="to.x" :y2="to.y" class="edge-hit"
    role="button" tabindex="0" :aria-label="'Edit link: ' + (link.comment || 'no comment')"
    @click.stop="handleStart" @keydown.enter.prevent="handleStart"></line>
  <text v-if="link && !isEditing" :x="mid.x" :y="mid.y" class="edge-comment" text-anchor="middle">{{ link.comment }}</text>
  <foreignObject v-if="isEditing" :x="mid.x - 90" :y="mid.y - 14" width="180" height="28" class="edge-comment-editor">
    <div xmlns="http://www.w3.org/1999/xhtml" class="edge-comment-form">
      <input ref="editor" v-model="draft" aria-label="Link comment"
        @blur="handleCommit" @keydown="handleKeydown" @pointerdown.stop @wheel.stop>
      <button v-if="link" type="button" class="icon-button" aria-label="Delete link" @mousedown.prevent="handleDelete">×</button>
    </div>
  </foreignObject>
</g>`;
export default { name, props, emits, setup, template };
