// シート操作をSVGアイコンで表示し、選択した操作を親へ通知する。
import AppIcon from './AppIcon.js';
// コンポーネントの識別名。
const name = 'Toolbar';

// 履歴に応じた操作の可否。
const props = {
  isBusy: { type: Boolean, default: false },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
};

// 親へ通知するシート操作。
const emits = ['newSheet', 'openSheetList', 'save', 'export', 'import', 'undo', 'redo'];

// 表示順とFeather Iconsの識別子。
const ACTIONS = [
  { event: 'newSheet', label: '新規', icon: 'file-plus' },
  { event: 'openSheetList', label: '読込', icon: 'folder' },
  { event: 'save', label: '保存', icon: 'save' },
  { event: 'export', label: 'エクスポート', icon: 'download' },
  { event: 'import', label: 'インポート', icon: 'upload' },
  { event: 'undo', label: '元に戻す', icon: 'rotate-ccw' },
  { event: 'redo', label: 'やり直す', icon: 'rotate-cw' },
];

// 操作の表示データと、履歴状態を確認するハンドラを返す。
function setup(props, { emit }) {
  const actions = ACTIONS;

  // 操作名を受け取り、履歴操作が無効かどうかを返す。
  function isDisabled(action) {
    return props.isBusy || (action.event === 'undo' && !props.canUndo)
      || (action.event === 'redo' && !props.canRedo);
  }

  // 選択された操作を受け取り、有効な場合だけ親へ通知する。
  function handleAction(action) {
    if (isDisabled(action)) return;

    emit(action.event);
  }

  return { actions, isDisabled, handleAction };
}

// アイコンと、ホバーまたはキーボードフォーカス時の説明。
const template = `
  <nav class="sheet-toolbar" aria-label="シート操作">
    <span v-for="action in actions" :key="action.event" class="toolbar-item">
      <button
        type="button"
        class="toolbar-button"
        :aria-label="action.label"
        :disabled="isDisabled(action)"
        @click="handleAction(action)"
      >
        <app-icon :icon="action.icon" :label="action.label"></app-icon>
      </button>
      <span class="toolbar-hint" aria-hidden="true">{{ action.label }}</span>
    </span>
  </nav>
`;

export default { name, props, emits, components: { AppIcon }, setup, template };
