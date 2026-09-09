// 現在の操作モードを、アプリ名の下に表示する。
import { computed } from 'vue';

// コンポーネントの識別名。
const name = 'ModeHud';

// 親から受け取る操作モード。
const props = {
  mode: { type: String, default: 'view' },
};

// このコンポーネントが発火するイベント。
const emits = ['wheelRequested'];

// 操作モードに対応する表示名。
const MODE_LABELS = {
  view: 'View',
  add: 'Add Node',
  remove: 'Delete Node',
  edit: 'Edit Node',
  join: 'Join Node',
  group: 'Make Group',
};

// propsのモードを表示名に変換し、テンプレートへ返す。
function setup(props, { emit }) {
  const modeLabel = computed(() => MODE_LABELS[props.mode] ?? 'View');
  // モード表示のクリック位置を親へ通知する。
  function handleOpen(event) { emit('wheelRequested', event); }
  return { modeLabel, handleOpen };
}

// 現在のモードを表示するテンプレート。
const template = `
  <button type="button" class="mode-hud text-button" aria-haspopup="menu" @click="handleOpen">Mode: {{ modeLabel }} ▾</button>
`;

export default { name, props, emits, setup, template };
