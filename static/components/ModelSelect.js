// モデルを上方向に開くメニューで選択し、システムプロンプトを編集する。
import { ref } from 'vue';
// コンポーネントの識別名。
const name = 'ModelSelect';
// モデル一覧と選択済みの設定。
const props = { models: { type: Array, default: () => [] }, currentModel: { type: String, default: '' },
  systemPrompt: { type: String, default: '' }, isBusy: Boolean, isLocked: Boolean,
  status: { type: String, default: '' }, hasError: Boolean };
// 設定変更とモデル一覧の再取得。
const emits = ['modelChanged', 'promptChanged', 'refresh', 'saveSettings'];
// ドロップダウンの開閉と、設定操作のハンドラを返す。
function setup(props, { emit }) {
  const isOpen = ref(false);
  // 開閉ボタンのクリックで候補一覧を切り替える。
  function handleToggle() { isOpen.value = !isOpen.value; }
  // モデル名を親へ通知し、候補を閉じる。
  function handleSelect(value) { emit('modelChanged', value); isOpen.value = false; }
  // 入力イベントからプロンプトを取り出し、親へ通知する。
  function handlePrompt(event) { emit('promptChanged', event.target.value); }
  // モデル一覧の更新を親へ通知する。
  function handleRefresh() { emit('refresh'); }
  // 設定領域外へフォーカスが移った場合は候補を閉じる。
  function handleFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) isOpen.value = false;
  }
  // 設定保存を再試行する。
  function handleSave() { emit('saveSettings'); }
  // Escapeで候補を閉じる。
  function handleClose() { isOpen.value = false; }
  return { isOpen, handleToggle, handleSelect, handlePrompt, handleRefresh, handleFocusOut, handleClose, handleSave };
}
// 右下のモデル選択と、その下のプロンプト領域。
const template = `<section class="model-settings ai-accent" aria-label="AI Settings"
  @focusout="handleFocusOut" @keydown.esc="handleClose">
  <div class="model-picker">
    <div v-if="isOpen" class="model-options" aria-label="Available Models">
      <p v-if="!models.length">No models are available.</p>
      <button v-for="model in models" :key="model" type="button" class="text-button list-child" :disabled="isLocked" @click="handleSelect(model)">{{ model }}</button>
      <button type="button" class="text-button float-right" :disabled="isBusy || isLocked" @click="handleRefresh">{{ isBusy ? 'Fetching…' : 'Fetch model list' }}</button>
    </div>
    <button type="button" class="text-button model-toggle" :disabled="isLocked" :aria-expanded="isOpen" @click="handleToggle">{{ currentModel || 'Select Model' }} ▴</button>
  </div>
  <label for="system-prompt">User Custom Prompt</label>
  <textarea id="system-prompt" :value="systemPrompt" :disabled="isLocked" @input="handlePrompt" rows="2" placeholder="AIへの指示を入力…"></textarea>
<p class="settings-status" :class="{ 'error-message': hasError }" role="status">{{ status }}</p>
  <button v-if="hasError" type="button" class="text-button" :disabled="isLocked" @click="handleSave">Retry Save</button>
</section>`;
export default { name, props, emits, setup, template };
