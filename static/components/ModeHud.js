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
  view: 'ビュー',
  add: 'ノード追加',
  remove: 'ノード削除',
  edit: 'ノード編集',
  join: 'ノード接続',
  group: 'グループ化',
};

// propsのモードを表示名に変換し、テンプレートへ返す。
function setup(props, { emit }) {
  const modeLabel = computed(() => MODE_LABELS[props.mode] ?? 'ビュー');
  // モード表示のクリック位置を親へ通知する。
  function handleOpen(event) { emit('wheelRequested', event); }
  return { modeLabel, handleOpen };
}

// 現在のモードを表示するテンプレート。
const template = `
  <button type="button" class="mode-hud text-button" aria-haspopup="menu" @click="handleOpen">モード：{{ modeLabel }} ▾</button>
`;

export default { name, props, emits, setup, template };
