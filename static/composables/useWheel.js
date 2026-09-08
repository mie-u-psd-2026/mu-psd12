// モード・AI・グループで共用するラジアルメニューの選択状態。
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
// モードの巡回順と表示情報。
export const MODE_ENTRIES = [
  { value: 'view', label: 'ビュー', icon: 'move' },
  { value: 'add', label: 'ノード追加', icon: 'plus' },
  { value: 'remove', label: 'ノード削除', icon: 'trash-2' },
  { value: 'edit', label: 'ノード編集', icon: 'edit-3' },
  { value: 'join', label: 'ノード接続', icon: 'link' },
  { value: 'group', label: 'グループ化', icon: 'layers' },
];
// AI機能のショートカット。実行処理は親へ委譲する。
const AI_ENTRIES = [
  { value: 'related', label: '関連アイデア', icon: 'git-branch' },
  { value: 'perspective', label: '新しい視点', icon: 'sun' },
  { value: 'link', label: '関連付け', icon: 'link' },
  { value: 'merge', label: 'ノード統合', icon: 'minimize-2' },
  { value: 'group', label: 'グループ化', icon: 'layers' },
  { value: 'summary', label: 'ノートに要約', icon: 'file-text' },
];
// 右クリックの長押し判定時間。
const HOLD_DELAY = 350;

// 汎用の開閉・選択処理と、マウス操作のハンドラを返す。
export function useWheel() {
  const isOpen = ref(false);
  const kind = ref('mode');
  const entries = ref(MODE_ENTRIES);
  const center = ref({ x: 160, y: 160 });
  const activeIndex = ref(-1);
  const isKeyboard = ref(false);
  const selection = ref(null);
  const activeEntry = computed(() => entries.value[activeIndex.value]);
  let holdTimer;
  let isHolding = false;
  let isWheelPriority = false;
  let origin = { x: 0, y: 0 };
  let hasShift = false;

  // 種類、項目、中心座標を受け取り、画面内に収まる位置で開く。
  function open(value, items, point) {
    kind.value = value;
    entries.value = items;
    center.value = { x: Math.max(144, Math.min(window.innerWidth - 144, point.x)),
      y: Math.max(144, Math.min(window.innerHeight - 144, point.y)) };
    activeIndex.value = -1;
    isWheelPriority = false;
    isOpen.value = true;
  }

  // 長押し待機と選択状態を解除して閉じる。
  function close() {
    clearTimeout(holdTimer);
    isHolding = false;
    isOpen.value = false;
    activeIndex.value = -1;
  }

  // 現在の選択を結果として通知し、メニューを閉じる。
  function commit() {
    if (activeEntry.value) selection.value = { kind: kind.value, entry: activeEntry.value };
    close();
  }

  // キャンバス上の右クリックを受け取り、長押しの判定を始める。
  function handlePointerDown(event) {
    if (event.button !== 2 || !event.target.closest('.sheet-canvas') || event.target.closest('input, textarea')) return;
    event.preventDefault();
    close();
    isHolding = true;
    isKeyboard.value = false;
    hasShift = event.shiftKey;
    origin = { x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => open(hasShift ? 'ai' : 'mode', hasShift ? AI_ENTRIES : MODE_ENTRIES, origin), HOLD_DELAY);
  }

  // カーソルの角度を項目番号へ変換し、中央では未選択にする。
  function handlePointerMove(event) {
    if (!isOpen.value || isWheelPriority || isKeyboard.value) return;
    const x = event.clientX - center.value.x;
    const y = event.clientY - center.value.y;
    if (Math.hypot(x, y) < 28) { activeIndex.value = -1; return; }
    const angle = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    activeIndex.value = Math.round(angle / (Math.PI * 2 / entries.value.length)) % entries.value.length;
  }

  // 右ボタン解除時に長押しを終了し、開いている場合は選択を確定する。
  function handlePointerUp(event) {
    if (event.button !== 2 || !isHolding) return;
    if (isOpen.value) commit();
    else close();
  }

  // メニュー表示中のスクロールを優先し、通常のモード切替への伝播を止める。
  function handleScroll(event) {
    if (!isOpen.value) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.deltaY) return;
    isWheelPriority = true;
    const length = entries.value.length;
    activeIndex.value = (activeIndex.value + Math.sign(event.deltaY) + length) % length;
  }

  // ShiftでAIメニューを切り替え、Escapeで選択を取り消す。
  function handleKeydown(event) {
    if (event.key === 'Escape') { close(); return; }
    if (event.key !== 'Shift' || !isHolding || hasShift) return;
    hasShift = true;
    if (isOpen.value) open('ai', AI_ENTRIES, center.value);
  }

  // Shift解除時にモードメニューへ戻す。
  function handleKeyup(event) {
    if (event.key !== 'Shift' || !isHolding) return;
    hasShift = false;
    if (isOpen.value) open('mode', MODE_ENTRIES, center.value);
  }

  // モード表示ボタンの位置を受け取り、キーボード操作可能なメニューを開く。
  function openKeyboard(event) {
    close();
    isKeyboard.value = true;
    const bounds = event.currentTarget.getBoundingClientRect();
    open('mode', MODE_ENTRIES, { x: bounds.right + 120, y: bounds.bottom + 120 });
    activeIndex.value = 0;
  }

  // クリックまたはキーボードで選択した番号を確定する。
  function select(index) {
    activeIndex.value = index;
    commit();
  }

  onMounted(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', close);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', handleKeyup);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('wheel', handleScroll, { capture: true, passive: false });
  });
  onBeforeUnmount(() => {
    close();
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', close);
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('keyup', handleKeyup);
    window.removeEventListener('blur', close);
    window.removeEventListener('resize', close);
    window.removeEventListener('wheel', handleScroll, true);
  });
  return { isOpen, kind, entries, center, activeIndex, isKeyboard, selection,
    open, close, select, openKeyboard, handlePointerDown };
}
