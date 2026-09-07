// ノードの描画と選択、モード切替、パン・ズームを管理する。
import { computed, ref } from 'vue';
import SheetNode from './SheetNode.js';
import SheetEdge from './SheetEdge.js';
import SheetGroup from './SheetGroup.js';
import { MODE_ENTRIES } from '../composables/useWheel.js';

// コンポーネントの識別名。
const name = 'SheetCanvas';
// シートの共有状態と現在の操作モード。
const props = {
  sheetState: { type: Object, required: true },
  mode: { type: String, default: 'view' },
};
// 親が実行する状態の更新。
const emits = ['modeChanged', 'nodeAdded', 'nodeTextChanged'];
// 設計書のモード巡回順。
const MODES = MODE_ENTRIES.map(entry => entry.value);
// 各モードで利用者へ表示する操作説明。
const HINTS = {
  view: 'ドラッグで移動', add: 'ノードをクリックして子を追加',
  edit: 'ノードをクリックして文字を編集', remove: '削除は準備中',
  join: '接続は準備中', group: 'グループ化は準備中',
};

// 一時的な描画座標と操作ハンドラを返す。
function setup(props, { emit }) {
  const editingId = ref(null);
  const pan = ref({ x: 0, y: 0 });
  const zoom = ref(1);
  let drag = null;
  let lastWheel = 0;
  const hint = computed(() => HINTS[props.mode]);
  // 物理シミュレーション接続前の、階層ごとの仮配置。
  const positions = computed(() => {
    const result = Object.create(null);
    const levels = new Map();
    const root = props.sheetState.nodes.find(node => node.parent === null);
    if (!root) return result;

    const queue = [{ node: root, depth: 0 }];
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      const level = levels.get(entry.depth) ?? [];
      level.push(entry.node);
      levels.set(entry.depth, level);
      props.sheetState.nodes.filter(node => node.parent === entry.node.id)
        .forEach(node => queue.push({ node, depth: entry.depth + 1 }));
    }
    levels.forEach((nodes, depth) => {
      nodes.forEach((node, i) => {
        result[node.id] = { x: depth * 256, y: (i - (nodes.length - 1) / 2) * 96 };
      });
    });
    return result;
  });
  const edges = computed(() => props.sheetState.nodes.filter(node => node.parent !== null));

  // ノードIDを受け取り、現在のモードに応じて追加または編集を開始する。
  function handleSelected(id) {
    if (props.mode === 'add') emit('nodeAdded', id);
    if (props.mode === 'edit') editingId.value = id;
  }

  // 編集結果を親へ渡して、入力欄を閉じる。
  function handleTextCommitted(id, text) {
    editingId.value = null;
    emit('nodeTextChanged', id, text);
  }

  // 編集を取消して元のノード表示へ戻す。
  function handleEditCancelled() {
    editingId.value = null;
  }

  // ホイール入力でモードを巡回し、Ctrl併用時はポインター位置を中心に拡大縮小する。
  function handleWheel(event) {
    if (!event.deltaY) return;
    if (event.ctrlKey) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left - bounds.width / 2;
      const y = event.clientY - bounds.top - bounds.height / 2;
      const scale = Math.min(2.5, Math.max(0.4, zoom.value * Math.exp(-event.deltaY * 0.002)));
      pan.value = { x: x - (x - pan.value.x) * scale / zoom.value,
        y: y - (y - pan.value.y) * scale / zoom.value };
      zoom.value = scale;
      return;
    }
    if (performance.now() - lastWheel < 180) return;
    lastWheel = performance.now();
    const index = MODES.indexOf(props.mode);
    emit('modeChanged', MODES[(index + Math.sign(event.deltaY) + MODES.length) % MODES.length]);
  }

  // ビューモードの左ドラッグ開始位置を記録する。
  function handlePointerDown(event) {
    if (props.mode !== 'view' || event.button !== 0) return;
    drag = { x: event.clientX - pan.value.x, y: event.clientY - pan.value.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  // ドラッグ中のポインター位置から表示位置を更新する。
  function handlePointerMove(event) {
    if (!drag) return;
    pan.value = { x: event.clientX - drag.x, y: event.clientY - drag.y };
  }

  // ドラッグ終了時に一時状態を解除する。
  function handlePointerEnd() {
    drag = null;
  }

  return { editingId, positions, edges, pan, zoom, hint, handleSelected,
    handleTextCommitted, handleEditCancelled, handleWheel, handlePointerDown,
    handlePointerMove, handlePointerEnd };
}

// 描画座標はシート本体と分離し、保存データには含めない。
const template = `
  <section class="sheet-canvas" aria-label="ブレストシート" @contextmenu.prevent
    @wheel.prevent="handleWheel" @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove" @pointerup="handlePointerEnd"
    @pointercancel="handlePointerEnd" @lostpointercapture="handlePointerEnd">
    <div class="sheet-content"
      :style="{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' }">
      <svg class="sheet-edges" aria-hidden="true">
        <sheet-group v-for="group in sheetState.groups" :key="group.id" :group="group" :positions="positions"></sheet-group>
        <sheet-edge v-for="link in sheetState.links" :key="link.id" :from="positions[link.a]" :to="positions[link.b]" type="indirect"></sheet-edge>
        <sheet-edge v-for="node in edges" :key="node.id"
          :from="positions[node.parent]" :to="positions[node.id]"></sheet-edge>
      </svg>
      <sheet-node v-for="node in sheetState.nodes" :key="node.id" :node="node"
        :position="positions[node.id]" :is-editing="editingId === node.id"
        @selected="handleSelected" @text-committed="handleTextCommitted"
        @edit-cancelled="handleEditCancelled"></sheet-node>
    </div>
    <p class="canvas-hint">{{ hint }} · ホイールでモード切替 · Ctrl＋ホイールでズーム · 右長押しでメニュー（ShiftでAI）</p>
  </section>
`;

export default { name, props, emits, components: { SheetNode, SheetEdge, SheetGroup }, setup, template };
