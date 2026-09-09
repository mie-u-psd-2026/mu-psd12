// シートの描画、パン・ズーム、モード別操作とAI提案の強調表示。
import { computed, ref, watch } from 'vue';
import SheetNode from './SheetNode.js';
import SheetEdge from './SheetEdge.js';
import SheetGroup from './SheetGroup.js';
import { usePhysicsSimulation } from '../composables/usePhysicsSimulation.js';
// コンポーネントの識別名。
const name = 'SheetCanvas';
// 編集対象、モード、提案と操作ロック。
const props = { sheetState: { type: Object, required: true }, mode: { type: String, default: 'view' },
  proposal: Object, isLocked: Boolean, targetPrompt: { type: String, default: '' } };
// 親が実行するシート変更と編集画面の要求。
const emits = ['modeChanged', 'nodeAdded', 'nodeTextChanged', 'nodeRemoved', 'linkAdded',
  'groupRequested', 'wheelRequested', 'editRequested', 'targetSelected', 'notice'];
// モードごとの操作説明。
const HINTS = { view: 'ドラッグで移動', add: 'ノードをクリックして子を追加', edit: 'クリックして文字を編集',
  remove: '600ms長押しで子孫ごと削除', join: '始点と終点を選んで接続', group: 'ノードで所属を選択・グループ名で編集' };

// 描画と入力の状態、操作ハンドラを返す。
function setup(props, { emit }) {
  const physics = usePhysicsSimulation(() => props.sheetState);
  const editingId = ref(null);
  const joinStart = ref(null);
  const isHolding = ref(false);
  const pan = ref({ x: 0, y: 0 });
  const zoom = ref(1);
  let drag = null;
  const isDragging = ref(false);
  const hint = computed(() => props.targetPrompt || (props.proposal ? 'AI提案を確認してください（破線＝変更・取り消し線＝削除）' : HINTS[props.mode]));
  const nodes = computed(() => props.proposal ? [...props.proposal.result.nodes,
    ...props.sheetState.nodes.filter(node => props.proposal.nodes.removed.includes(node.id))] : props.sheetState.nodes);
  const links = computed(() => props.proposal ? [...props.proposal.result.links,
    ...props.sheetState.links.filter(link => props.proposal.links.removed.includes(link.id))] : props.sheetState.links);
  const groups = computed(() => props.proposal ? [...props.proposal.result.groups,
    ...props.sheetState.groups.filter(group => props.proposal.groups.removed.includes(group.id))] : props.sheetState.groups);
  const positions = computed(() => {
    const result = { ...physics.positions.value };
    const pending = nodes.value.filter(node => !result[node.id]);
    // 提案の新規ノードも親の近くに表示する。保存済み座標は変更しない。
    for (let i = 0; i < pending.length; i++) {
      const node = pending[i];
      const parent = result[node.parent] || { x: 0, y: 0 };
      result[node.id] = { x: parent.x + 256, y: parent.y + (i - (pending.length - 1) / 2) * 112, width: 192, height: 56 };
    }
    return result;
  });
  const edges = computed(() => nodes.value.filter(node => node.parent !== null));
  watch(() => [props.mode, props.isLocked, props.targetPrompt], () => { editingId.value = null; joinStart.value = null; });
  watch(() => [editingId.value, isHolding.value, !!props.proposal], values => physics.pause(values.some(Boolean)));

  // 対象ノードとイベントを受け取り、モードに対応する操作を実行する。
  function handleSelected(id, event) {
    if (props.isLocked) return;
    if (props.targetPrompt) { emit('targetSelected', id); return; }
    if (props.mode === 'add') emit('nodeAdded', id);
    if (props.mode === 'edit') editingId.value = id;
    if (props.mode === 'remove' && props.sheetState.nodes.find(node => node.id === id)?.parent === null) emit('notice', 'テーマノードは削除できません。');
    if (props.mode === 'group') emit('groupRequested', id, event);
    if (props.mode !== 'join') return;
    if (!joinStart.value) { joinStart.value = id; return; }
    if (joinStart.value !== id) emit('linkAdded', joinStart.value, id);
    joinStart.value = null;
  }
  // 長押し完了後に削除を要求する。
  function handleRemoved(id) { if (!props.isLocked) emit('nodeRemoved', id); }
  // 長押し中はシミュレーションを停止する。
  function handleHolding(value) { isHolding.value = value; }
  // 実測サイズを物理計算へ渡す。
  function handleSize(id, size) { physics.resize(id, size); }
  // 編集した文字列を親へ渡す。
  function handleTextCommitted(id, text) { editingId.value = null; emit('nodeTextChanged', id, text); }
  // 編集を取り消す。
  function handleEditCancelled() { editingId.value = null; }
  // 接続編集の対象と位置を親へ渡す。
  function handleLinkEdit(link, event) { emit('editRequested', 'link', link, event); }
  // グループ編集の対象と位置を親へ渡す。
  function handleGroupEdit(group, event) { emit('editRequested', 'group', group, event); }
  // Escapeで接続選択を解除する。
  function handleEscape() { joinStart.value = null; editingId.value = null; }
  // ホイールでモードを切替え、Ctrl併用時はポインター中心で拡大縮小する。
  function handleWheel(event) {
    if (!event.deltaY) return;
    if (event.ctrlKey) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left - bounds.width / 2;
      const y = event.clientY - bounds.top - bounds.height / 2;
      const scale = Math.min(2.5, Math.max(.25, zoom.value * Math.exp(-event.deltaY * .002)));
      pan.value = { x: x - (x - pan.value.x) * scale / zoom.value, y: y - (y - pan.value.y) * scale / zoom.value };
      zoom.value = scale;
      return;
    }
    if (props.isLocked) return;
    emit('wheelRequested', event);
  }
  // ビューモードまたは提案確認中にドラッグ移動を開始する。
  function handlePointerDown(event) {
    if ((props.mode !== 'view' && !props.proposal) || event.button !== 0 || event.target.closest('input, textarea')) return;
    if (props.targetPrompt && event.target.closest('[data-node-id]')) return;
    isDragging.value = true;
    drag = { x: event.clientX - pan.value.x, y: event.clientY - pan.value.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  // ドラッグ位置を反映する。
  function handlePointerMove(event) {
    if (!drag) return;
    pan.value = { x: event.clientX - drag.x, y: event.clientY - drag.y };
  }
  // ドラッグを終了する。
  function handlePointerEnd() { drag = null; isDragging.value = false; }
  return { isDragging, editingId, joinStart, positions, nodes, links, groups, edges, pan, zoom, hint, isRunning: physics.isRunning,
    handleSelected, handleRemoved, handleHolding, handleSize, handleTextCommitted, handleEditCancelled,
    handleLinkEdit, handleGroupEdit, handleEscape, handleWheel, handlePointerDown, handlePointerMove, handlePointerEnd };
}
// 提案中も元のシートを保持し、結果と削除予定の要素を重ねて表示する。
const template = `<section class="sheet-canvas" aria-label="ブレストシート" :style="{ cursor: mode === 'view' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair', backgroundSize: (24 * zoom) + 'px ' + (24 * zoom) + 'px', backgroundPosition: 'calc(50% + ' + pan.x + 'px) calc(50% + ' + pan.y + 'px)' }" @contextmenu.prevent
  @wheel.prevent="handleWheel" @pointerdown="handlePointerDown" @pointermove="handlePointerMove"
  @pointerup="handlePointerEnd" @pointercancel="handlePointerEnd" @lostpointercapture="handlePointerEnd" @keydown.esc="handleEscape">
  <div class="sheet-content" :style="{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' }">
    <svg class="sheet-edges">
      <sheet-group v-for="group in groups" :key="group.id" :group="group" :positions="positions"
        :can-edit="mode === 'group' && !isLocked" :is-changed="!!proposal?.groups.changed.includes(group.id)"
        :is-removed="!!proposal?.groups.removed.includes(group.id)" @edit-requested="handleGroupEdit"></sheet-group>
      <sheet-edge v-for="link in links" :key="link.id" :from="positions[link.a]" :to="positions[link.b]" :link="link" type="indirect"
        :can-edit="mode === 'join' && !isLocked" :is-changed="!!proposal?.links.changed.includes(link.id)"
        :is-removed="!!proposal?.links.removed.includes(link.id)" @edit-requested="handleLinkEdit"></sheet-edge>
      <sheet-edge v-for="node in edges" :key="'direct-' + node.id" :from="positions[node.parent]" :to="positions[node.id]"
        :is-changed="!!proposal?.nodes.changed.includes(node.id)" :is-removed="!!proposal?.nodes.removed.includes(node.id)"></sheet-edge>
    </svg>
    <sheet-node v-for="node in nodes" :key="node.id" :node="node" :position="positions[node.id]"
      :is-editing="editingId === node.id" :can-remove="mode === 'remove' && node.parent !== null && !targetPrompt"
      :is-locked="isLocked" :is-selected="joinStart === node.id" :is-changed="!!proposal?.nodes.changed.includes(node.id)"
      :is-removed="!!proposal?.nodes.removed.includes(node.id)" @selected="handleSelected" @remove-requested="handleRemoved"
      @holding-changed="handleHolding" @size-changed="handleSize" @text-committed="handleTextCommitted" @edit-cancelled="handleEditCancelled"></sheet-node>
  </div>
  <p class="canvas-hint">{{ hint }} · ホイールでモード · Ctrl＋ホイールでズーム · 右長押し（ShiftでAI）</p>
</section>`;
export default { name, props, emits, components: { SheetNode, SheetEdge, SheetGroup }, setup, template };
