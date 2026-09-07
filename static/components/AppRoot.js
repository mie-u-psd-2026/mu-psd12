// 常設UIとシートを組み立て、共有状態と各操作を接続する。
import { ref, watch } from 'vue';
import ModeHud from './ModeHud.js';
import SheetTitle from './SheetTitle.js';
import Toolbar from './Toolbar.js';
import SheetCanvas from './SheetCanvas.js';
import SheetListPanel from './SheetListPanel.js';
import RadialWheel from './RadialWheel.js';
import NotesPanel from './NotesPanel.js';
import MutterInput from './MutterInput.js';
import ModelSelect from './ModelSelect.js';
import DiscardPanel from './DiscardPanel.js';
import { useSheetSession } from '../composables/useSheetSession.js';
import { useWheel } from '../composables/useWheel.js';
import { useApiClient } from '../composables/useApiClient.js';

// コンポーネントの識別名。
const name = 'AppRoot';
// ルートの入力。
const props = {};
// 外部への通知。
const emits = [];

// シート、ツールバー、ラジアルメニューを接続する状態とハンドラを返す。
function setup() {
  const session = useSheetSession();
  const wheel = useWheel();
  const api = useApiClient();
  const mode = ref('view');
  const fileInput = ref(null);
  const models = ref([]);
  const currentModel = ref('');
  const systemPrompt = ref('');
  const isModelsBusy = ref(false);

  watch(wheel.selection, value => {
    if (value?.kind === 'mode') mode.value = value.entry.value;
    if (value?.kind === 'ai') session.notify(`${value.entry.label}のAI連携は準備中です。`);
  });

  // シートのモード選択を反映する。
  function handleModeChanged(value) { mode.value = value; }
  // タイトルの編集を履歴付きで反映する。
  function handleTitleChanged(value) { session.changeTitle(value); }
  // ノードの追加を履歴付きで反映する。
  function handleNodeAdded(id) { session.createNode(id); }
  // ノードの編集を履歴付きで反映する。
  function handleNodeTextChanged(id, text) { session.changeNode(id, text); }
  // 新規作成を要求する。
  function handleNew() { session.newSheet(); }
  // 保存済み一覧を取得する。
  function handleOpenList() { session.openList(); }
  // 保存済み一覧を閉じる。
  function handleCloseList() { session.isListOpen.value = false; }
  // 選択されたシートを読み込む。
  function handleLoad(id) { session.loadSheet(id); }
  // 編集中のシートを保存する。
  function handleSave() { session.save(); }
  // JSONをダウンロードする。
  function handleExport() { session.exportSheet(); }
  // ファイル選択を開く。
  function handleImport() { fileInput.value?.click(); }
  // 選択されたJSONを取り込み、同じファイルを再選択できるよう入力を空にする。
  async function handleFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    await session.importSheet(file);
  }
  // 一操作を元に戻す。
  function handleUndo() { session.undo(); }
  // 一操作をやり直す。
  function handleRedo() { session.redo(); }
  // 未保存変更の破棄を確定する。
  function handleConfirm() { session.confirmSwitch(); }
  // シート切替を取り消す。
  function handleCancel() { session.cancelSwitch(); }
  // キャンバスでの長押しをホイールへ渡す。
  function handlePointerDown(event) {
    if (session.isBusy.value || session.pendingAction.value) return;
    wheel.handlePointerDown(event);
  }
  // モード表示からキーボードで操作できるホイールを開く。
  function handleOpenWheel(event) { wheel.openKeyboard(event); }
  // 汎用ホイールの選択を確定する。
  function handleWheelSelect(index) { wheel.select(index); }
  // 汎用ホイールを閉じる。
  function handleWheelClose() { wheel.close(); }
  // 選択したモデル名を保持する。
  function handleModelChanged(value) { currentModel.value = value; }
  // 入力したプロンプトを保持する。
  function handlePromptChanged(value) { systemPrompt.value = value; }
  // モデル一覧を取得し、取得できない場合は通知を表示する。
  async function handleModelsRefresh() {
    if (isModelsBusy.value) return;
    isModelsBusy.value = true;
    try {
      const data = await api.getModels();
      if (!Array.isArray(data) || data.some(item => typeof item !== 'string')) throw new Error('モデル一覧の応答形式が不正です。');
      models.value = data;
      session.notify(data.length ? 'モデル一覧を取得しました。' : '利用可能なモデルはありません。');
    } catch (err) { session.notify(err.message, true); }
    finally { isModelsBusy.value = false; }
  }

  return { ...session, mode, fileInput, models, currentModel, systemPrompt, isModelsBusy,
    isWheelOpen: wheel.isOpen, wheelEntries: wheel.entries, wheelCenter: wheel.center,
    wheelIndex: wheel.activeIndex, wheelKind: wheel.kind, isWheelKeyboard: wheel.isKeyboard,
    handleModeChanged, handleTitleChanged, handleNodeAdded, handleNodeTextChanged,
    handleNew, handleOpenList, handleCloseList, handleLoad, handleSave, handleExport,
    handleImport, handleFile, handleUndo, handleRedo, handleConfirm, handleCancel,
    handlePointerDown, handleOpenWheel, handleWheelSelect, handleWheelClose,
    handleModelChanged, handlePromptChanged, handleModelsRefresh };
}

// 8pxグリッドの余白で各常設領域を配置する。
const template = `
  <main class="app-root" @pointerdown="handlePointerDown">
    <div class="sheet-workspace" :inert="isBusy || !!pendingAction">
      <sheet-canvas :key="version" :sheet-state="sheetState" :mode="mode"
        @mode-changed="handleModeChanged" @node-added="handleNodeAdded"
        @node-text-changed="handleNodeTextChanged"></sheet-canvas>
      <header class="app-header">
        <h1 class="app-title">AIサポート付きブレスト</h1>
        <mode-hud :mode="mode" @wheel-requested="handleOpenWheel"></mode-hud>
      </header>
    </div>
    <div class="sheet-header" :inert="!!pendingAction">
      <sheet-title :title="title" :disabled="isBusy" @title-changed="handleTitleChanged"></sheet-title>
      <span class="save-state">{{ hasChanges || !sheetId ? '未保存' : '保存済み' }}</span>
      <sheet-toolbar :can-undo="canUndo" :can-redo="canRedo" :is-busy="isBusy"
        @new-sheet="handleNew" @open-sheet-list="handleOpenList" @save="handleSave"
        @export="handleExport" @import="handleImport" @undo="handleUndo" @redo="handleRedo"></sheet-toolbar>
      <p class="toolbar-status" :class="{ 'error-message': hasError }" role="status">{{ message }}</p>
      <sheet-list-panel v-if="isListOpen" :sheets="sheets" :is-busy="isBusy" :has-error="hasError"
        @select="handleLoad" @create-new="handleNew" @close="handleCloseList" @retry="handleOpenList"></sheet-list-panel>
    </div>
    <aside class="left-tools" :inert="!!pendingAction">
      <notes-panel :notes="sheetState.notes"></notes-panel>
      <mutter-input :can-submit="false"></mutter-input>
    </aside>
    <aside class="right-tools" :inert="!!pendingAction">
      <model-select :models="models" :current-model="currentModel" :system-prompt="systemPrompt" :is-busy="isModelsBusy"
        @model-changed="handleModelChanged" @prompt-changed="handlePromptChanged" @refresh="handleModelsRefresh"></model-select>
    </aside>
    <div class="proposal-region" aria-live="polite"></div>
    <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="handleFile">
    <radial-wheel v-if="isWheelOpen" :entries="wheelEntries" :center="wheelCenter"
      :active-index="wheelIndex" :kind="wheelKind" :is-keyboard="isWheelKeyboard"
      @select="handleWheelSelect" @close="handleWheelClose"></radial-wheel>
    <discard-panel v-if="pendingAction" :label="pendingAction.label" @confirm="handleConfirm" @cancel="handleCancel"></discard-panel>
  </main>`;

export default { name, props, emits, components: { ModeHud, SheetTitle, SheetToolbar: Toolbar,
  SheetCanvas, SheetListPanel, RadialWheel, NotesPanel, MutterInput, ModelSelect, DiscardPanel }, setup, template };
