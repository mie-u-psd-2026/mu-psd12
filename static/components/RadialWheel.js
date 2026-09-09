// 項目配列を受け取る汎用ラジアルメニュー。モード・AI・グループで共用する。
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import AppIcon from './AppIcon.js';
// コンポーネントの識別名。
const name = 'RadialWheel';
// 項目、表示位置、選択状態とキーボード操作の有無。
const props = { entries: { type: Array, required: true }, center: { type: Object, required: true },
  activeIndex: { type: Number, default: -1 }, kind: { type: String, default: 'mode' }, isKeyboard: Boolean };
// 項目選択または閉じる操作。
const emits = ['select', 'close'];

// 円周上の座標とキーボード操作のハンドラを返す。
function setup(props, { emit }) {
  const menu = ref(null);
  let previousFocus;
  const items = computed(() => props.entries.map((entry, index) => ({ ...entry,
    x: Math.sin(index * Math.PI * 2 / props.entries.length) * 88,
    y: -Math.cos(index * Math.PI * 2 / props.entries.length) * 88 })));
  onMounted(() => {
    if (!props.isKeyboard) return;
    previousFocus = document.activeElement;
    menu.value?.querySelector('button')?.focus();
  });
  onBeforeUnmount(() => previousFocus?.focus());

  // 項目番号を親へ通知する。
  function handleSelect(index) { emit('select', index); }
  // 外側のクリックを受け取り、メニューを閉じる。
  function handleClose() { emit('close'); }
  // 矢印キーで項目間のフォーカスを巡回させる。
  function handleKeydown(event) {
    if (event.key === 'Escape') { emit('close'); return; }
    const buttons = [...menu.value.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    buttons[next]?.focus();
  }
  return { menu, items, handleSelect, handleClose, handleKeydown };
}
// 色付き項目はグループ用、アイコン項目はモード・AI用として表示する。
const template = `
  <div class="wheel-backdrop" @click.self="handleClose" @contextmenu.prevent>
    <div ref="menu" class="radial-wheel" :class="{ 'ai-accent': kind === 'ai' }"
      role="menu" :aria-label="kind === 'ai' ? 'AI Features' : 'Action Menu'"
      :style="{ left: center.x + 'px', top: center.y + 'px' }" @keydown="handleKeydown">
      <span class="wheel-center">{{ kind === 'ai' ? 'AI' : kind === 'group' ? 'GROUP' : 'MODE' }}</span>
      <button v-for="(entry, index) in items" :key="entry.value" type="button" role="menuitem"
        class="wheel-entry" :class="{ 'is-active': activeIndex === index }" :aria-label="entry.label"
        :style="{ left: entry.x + 'px', top: entry.y + 'px' }" @click.stop="handleSelect(index)">
        <span v-if="entry.color" class="group-dot" :style="{ backgroundColor: entry.color }"></span>
        <app-icon v-else :icon="entry.icon" :label="entry.label"></app-icon>
        <span class="wheel-label">{{ entry.label }}</span>
      </button>
    </div>
  </div>`;
export default { name, props, emits, components: { AppIcon }, setup, template };
