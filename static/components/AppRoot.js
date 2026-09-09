// シート編集、AI提案、設定、各パネルを組み立てるルート。
import { computed, ref, watch, onMounted } from 'vue';
import ModeHud from './ModeHud.js';
import SheetTitle from './SheetTitle.js';
import Toolbar from './Toolbar.js';
import SheetCanvas from './SheetCanvas.js';
import SheetListPanel from './SheetListPanel.js';
import RadialWheel from './RadialWheel.js';
import NotesPanel from './NotesPanel.js';
import GroupListPanel from './GroupListPanel.js';
import NoteEditor from './NoteEditor.js';
import MutterInput from './MutterInput.js';
import ModelSelect from './ModelSelect.js';
import DiscardPanel from './DiscardPanel.js';
import EditPanel from './EditPanel.js';
import AiProposalPanel from './AiProposalPanel.js';
import { useSheetSession } from '../composables/useSheetSession.js';
import { useWheel } from '../composables/useWheel.js';
import { useAppSettings } from '../composables/useAppSettings.js';
import { useEditorPanels } from '../composables/useEditorPanels.js';
// コンポーネントの識別名。
const name = 'AppRoot';
// ルートの入力。
const props = {};
// 外部への通知。
const emits = [];
// APIへ渡すモード名。モックの機能名と対応させる。
const AI_MODES = { related: 'expand', perspective: 'newview', link: 'link', merge: 'merge', group: 'group', summary: 'note' };

// 共有状態と画面操作を接続して返す。
function setup() {
  const session = useSheetSession();
  const mode = ref('view');
  const wheel = useWheel(() => mode.value);
  const settings = useAppSettings();
  const panels = useEditorPanels(session, wheel);
  const fileInput = ref(null);
  const isStarting = ref(true);
  const isAiPreparing = ref(false);
  const targetAction = ref(null);
  const hasPanel = computed(() => !!panels.editPanel.value || !!panels.noteEditor.value);
  const controlsLocked = computed(() => isStarting.value || isAiPreparing.value || session.isLocked.value || hasPanel.value);
  const canUseAi = computed(() => !controlsLocked.value && !settings.isModelsBusy.value && settings.models.value.includes(settings.currentModel.value));
  const targetPrompt = computed(() => targetAction.value ? `${targetAction.value.label}：対象ノードをクリックしてください` : '');

  onMounted(async () => {
    try {
      const id = await settings.restore();
      const restoreError = settings.hasError.value ? settings.status.value : '';
      if (id) await session.loadSheet(id);
      await settings.refreshModels();
      if (restoreError) session.notify(restoreError, true);
    } finally { isStarting.value = false; }
  });
  watch(session.version, () => { targetAction.value = null; });
  watch(mode, () => { panels.closeEdit(); panels.closeNote(); targetAction.value = null; });
  watch(wheel.selection, value => {
    if (value?.kind === 'mode') mode.value = value.entry.value;
    if (value?.kind === 'group') panels.selectGroup(value.entry.value);
    if (value?.kind === 'ai') handleAiChoice(value.entry);
  });

  // シートのモードを変更する。
  function handleModeChanged(value) { mode.value = value; }
  // シートタイトルを編集する。
  function handleTitleChanged(value) { session.changeTitle(value); }
  // 子ノードを追加する。
  function handleNodeAdded(id) { session.createNode(id); }
  // ノードの文字列を編集する。
  function handleNodeTextChanged(id, text) { session.changeNode(id, text); }
  // 長押し対象のノードを削除する。
  function handleNodeRemoved(id) { session.deleteNode(id); }
  // 2つのノードを接続する。
  function handleLinkAdded(a, b) { session.createLink(a, b); }
  // グループ所属の選択を開く。
  function handleGroupRequested(id, event) { panels.openGroups(id, event); }
  // 接続・グループの編集パネルを開く。
  function handleEditRequested(kind, item, event) { panels.openEdit(kind, item, event); }
  // 編集結果を保存する。
  function handleEditSave(title, comment, color) { panels.saveEdit(title, comment, color); }
  // 編集対象を削除する。
  function handleEditDelete() { panels.deleteEdit(); }
  // 編集を取り消す。
  function handleEditClose() { panels.closeEdit(); }
  // 新規ノートの編集を開く。
  function handleNoteCreate() { panels.openNote(); }
  // 既存ノートの編集を開く。
  function handleNoteEdit(note) { panels.openNote(note); }
  // ノートを保存する。
  function handleNoteSave(id, title, body) { panels.saveNote(id, title, body); }
  // ノート編集を取り消す。
  function handleNoteClose() { panels.closeNote(); }
  // ノートを削除する。Undoで復元できる。
  function handleNoteDelete(id) { session.deleteNote(id); }
  // 操作の説明を表示する。
  function handleNotice(text) { session.notify(text); }
  // 新規シートを作成する。
  function handleNew() { targetAction.value = null; session.newSheet(); }
  // 保存済み一覧を開く。
  function handleOpenList() { session.openList(); }
  // 保存済み一覧を閉じる。
  function handleCloseList() { session.isListOpen.value = false; }
  // シートを読み込む。
  function handleLoad(id) { session.loadSheet(id); }
  // 保存済みシートを削除する。
  function handleDeleteSheet(id) { session.deleteSheet(id); }
  // シートを保存する。
  function handleSave() { session.save(); }
  // JSONとして出力する。
  function handleExport() { session.exportSheet(); }
  // JSONの選択画面を開く。
  function handleImport() { fileInput.value?.click(); }
  // 選択されたJSONを取り込む。
  async function handleFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    await session.importSheet(file);
  }
  // Undoを実行する。
  function handleUndo() { session.undo(); }
  // Redoを実行する。
  function handleRedo() { session.redo(); }
  // 保留された切替・削除を確定する。
  function handleConfirm() { session.confirmSwitch(); }
  // 保留された切替・削除を取り消す。
  function handleCancel() { session.cancelSwitch(); }
  // 右長押しをホイールへ渡す。
  function handlePointerDown(event) {
    if (controlsLocked.value || session.pendingAction.value) return;
    wheel.handlePointerDown(event);
  }
  // スクロールによるモード選択をホイールへ渡す。
  function handleWheelRequested(event) { if (!controlsLocked.value) wheel.scrollMode(event, mode.value); }
  // キーボード操作用ホイールを開く。
  function handleOpenWheel(event) { if (!controlsLocked.value) wheel.openKeyboard(event); }
  // ホイール選択を確定する。
  function handleWheelSelect(index) { wheel.select(index); }
  // ホイールを閉じる。
  function handleWheelClose() { wheel.close(); }
  // モデル設定を保存する。
  function handleModelChanged(value) { settings.changeModel(value); }
  // システムプロンプトを保存する。
  function handlePromptChanged(value) { settings.changePrompt(value); }
  // モデル一覧を再取得する。
  function handleModelsRefresh() { settings.refreshModels(); }
  // 設定の保存を再試行する。
  function handleSettingsSave() { settings.flush(); }

  // 設定保存を待ってからAIを要求する。シート自動保存はセッション側が行う。
  async function runAi(request) {
    if (!canUseAi.value) { session.notify('利用可能なモデルを選択してください。', true); return; }
    isAiPreparing.value = true;
    try {
      if (!await settings.flush()) { session.notify('設定を保存できなかったため、AIの呼び出しを中止しました。', true); return; }
      await session.requestAi({ ...request, model_name: settings.currentModel.value, system_prompt: settings.systemPrompt.value });
    } finally { isAiPreparing.value = false; }
  }
  // AI機能を選択し、必要なら対象ノードのクリックを待つ。
  function handleAiChoice(entry) {
    if (!canUseAi.value) { session.notify('利用可能なモデルを選択してください。', true); return; }
    if (entry.value === 'perspective') { runAi({ mode: AI_MODES[entry.value], target_node_id: '' }); return; }
    targetAction.value = entry;
  }
  // 選択したノードを対象にAIを要求する。
  function handleTargetSelected(id) {
    if (!targetAction.value) return;
    const action = targetAction.value;
    targetAction.value = null;
    runAi({ mode: AI_MODES[action.value], target_node_id: id });
  }
  // シート全体の要約を要求する。
  function handleWholeSummary() { targetAction.value = null; runAi({ mode: 'note', target_node_id: '' }); }
  // AIの対象選択を取り消す。
  function handleTargetCancel() { targetAction.value = null; }
  // メモ本文をAIへ渡す。入力本文は失敗・却下しても消さない。
  function handleMutter(text) { targetAction.value = null; runAi({ mode: 'mutter', target_node_id: '', text }); }
  // AI提案を一括承認する。
  function handleProposalCommit() { session.commitProposal(); }
  // AI提案を却下する。
  function handleProposalReject() { session.rejectProposal(); }

  return { ...session, ...panels, mode, fileInput, isStarting, isAiPreparing, controlsLocked, hasPanel, canUseAi, targetAction, targetPrompt,
    models: settings.models, currentModel: settings.currentModel, systemPrompt: settings.systemPrompt, isModelsBusy: settings.isModelsBusy,
    settingsStatus: settings.status, settingsError: settings.hasError,
    isWheelOpen: wheel.isOpen, wheelEntries: wheel.entries, wheelCenter: wheel.center,
    wheelIndex: wheel.activeIndex, wheelKind: wheel.kind, isWheelKeyboard: wheel.isKeyboard,
    handleModeChanged, handleTitleChanged, handleNodeAdded, handleNodeTextChanged, handleNodeRemoved, handleLinkAdded,
    handleGroupRequested, handleEditRequested, handleEditSave, handleEditDelete, handleEditClose,
    handleNoteCreate, handleNoteEdit, handleNoteSave, handleNoteClose, handleNoteDelete, handleNotice,
    handleNew, handleOpenList, handleCloseList, handleLoad, handleDeleteSheet, handleSave, handleExport,
    handleImport, handleFile, handleUndo, handleRedo, handleConfirm, handleCancel,
    handlePointerDown, handleOpenWheel, handleWheelRequested, handleWheelSelect, handleWheelClose, handleModelChanged, handlePromptChanged,
    handleModelsRefresh, handleSettingsSave, handleTargetSelected, handleWholeSummary, handleTargetCancel, handleMutter,
    handleProposalCommit, handleProposalReject };
}
// 提案中は編集操作をロックし、パン・ズームによる確認は可能にする。
const template = `<main class="app-root" @pointerdown="handlePointerDown">
  <div class="vignette" aria-hidden="true"></div>
  <div class="sheet-workspace" :inert="isBusy || isStarting || isAiPreparing || !!pendingAction || hasPanel">
    <sheet-canvas :key="version" :sheet-state="sheetState" :mode="mode" :proposal="proposal" :is-locked="isLocked || hasPanel"
      :target-prompt="targetPrompt" @mode-changed="handleModeChanged" @wheel-requested="handleWheelRequested" @node-added="handleNodeAdded" @node-text-changed="handleNodeTextChanged"
      @node-removed="handleNodeRemoved" @link-added="handleLinkAdded" @group-requested="handleGroupRequested"
      @edit-requested="handleEditRequested" @target-selected="handleTargetSelected" @notice="handleNotice"></sheet-canvas>
    <header class="app-header"><h1 class="app-title">AIサポート付きブレスト</h1>
      <mode-hud :mode="mode" @wheel-requested="handleOpenWheel"></mode-hud></header>
  </div>
  <div class="sheet-header" :inert="!!pendingAction">
    <sheet-title :title="title" :disabled="controlsLocked" @title-changed="handleTitleChanged"></sheet-title>
    <span class="save-state">{{ hasChanges || !sheetId ? '未保存' : '保存済み' }}</span>
    <sheet-toolbar :can-undo="canUndo" :can-redo="canRedo" :is-busy="controlsLocked"
      @new-sheet="handleNew" @open-sheet-list="handleOpenList" @save="handleSave" @export="handleExport"
      @import="handleImport" @undo="handleUndo" @redo="handleRedo"></sheet-toolbar>
    <p class="toolbar-status" :class="{ 'error-message': hasError }" role="status">{{ isStarting ? '設定を復元しています…' : message }}</p>
    <sheet-list-panel v-if="isListOpen" :sheets="sheets" :is-busy="controlsLocked" :has-error="hasError"
      @select="handleLoad" @create-new="handleNew" @close="handleCloseList" @retry="handleOpenList" @delete="handleDeleteSheet"></sheet-list-panel>
  </div>
  <aside class="left-tools" :inert="!!pendingAction || hasPanel">
    <group-list-panel v-if="mode === 'group'" :groups="sheetState.groups" :is-locked="controlsLocked" @edit="handleEditRequested"></group-list-panel>
    <notes-panel :notes="sheetState.notes" :is-locked="controlsLocked" @create="handleNoteCreate" @edit="handleNoteEdit" @delete="handleNoteDelete"></notes-panel>
    <mutter-input :can-submit="canUseAi" :is-busy="controlsLocked" @submit="handleMutter"></mutter-input>
  </aside>
  <aside class="right-tools" :inert="!!pendingAction || hasPanel">
    <model-select :models="models" :current-model="currentModel" :system-prompt="systemPrompt" :is-busy="isModelsBusy" :is-locked="controlsLocked"
      :status="settingsStatus" :has-error="settingsError" @model-changed="handleModelChanged" @prompt-changed="handlePromptChanged"
      @refresh="handleModelsRefresh" @save-settings="handleSettingsSave"></model-select>
  </aside>
  <div class="proposal-region" aria-live="polite">
    <div v-if="targetAction" class="ai-target"><p>{{ targetPrompt }}</p>
      <button v-if="targetAction.value === 'summary'" type="button" class="text-button" @click="handleWholeSummary">シート全体を要約</button>
      <button type="button" class="text-button" @click="handleTargetCancel">キャンセル</button></div>
    <ai-proposal-panel v-if="proposal" :proposal="proposal" @commit="handleProposalCommit" @reject="handleProposalReject"></ai-proposal-panel>
  </div>
  <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="handleFile">
  <radial-wheel v-if="isWheelOpen" :entries="wheelEntries" :center="wheelCenter" :active-index="wheelIndex"
    :kind="wheelKind" :is-keyboard="isWheelKeyboard" @select="handleWheelSelect" @close="handleWheelClose"></radial-wheel>
  <edit-panel v-if="editPanel" :key="editPanel.kind + (editPanel.item.id || '')" :heading="editPanel.kind === 'link' ? '接続を編集' : 'グループを編集'"
    :has-title="editPanel.kind !== 'link'" :title="editPanel.item.title" :comment="editPanel.item.comment" :color="editPanel.item.color"
    :can-delete="editPanel.kind !== 'newGroup'" :x="editPanel.x" :y="editPanel.y"
    @save="handleEditSave" @delete="handleEditDelete" @close="handleEditClose"></edit-panel>
  <note-editor v-if="noteEditor" :note="noteEditor.note" @save="handleNoteSave" @close="handleNoteClose"></note-editor>
  <discard-panel v-if="pendingAction" :label="pendingAction.label" :title="pendingAction.title" :message="pendingAction.message"
    @confirm="handleConfirm" @cancel="handleCancel"></discard-panel>
</main>`;
export default { name, props, emits, components: { ModeHud, SheetTitle, SheetToolbar: Toolbar, SheetCanvas,
  SheetListPanel, RadialWheel, NotesPanel, GroupListPanel, NoteEditor, MutterInput, ModelSelect, DiscardPanel, EditPanel, AiProposalPanel }, setup, template };
