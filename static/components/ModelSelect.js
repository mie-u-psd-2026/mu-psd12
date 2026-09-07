// モデルを上方向に開くメニューで選択し、システムプロンプトを編集する。
import { ref } from 'vue';
// コンポーネントの識別名。
const name = 'ModelSelect';
// モデル一覧と選択済みの設定。
const props = { models: { type: Array, default: () => [] }, currentModel: { type: String, default: '' },
  systemPrompt: { type: String, default: '' }, isBusy: Boolean };
// 設定変更とモデル一覧の再取得。
const emits = ['modelChanged', 'promptChanged', 'refresh'];
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
  // Escapeで候補を閉じる。
  function handleClose() { isOpen.value = false; }
  return { isOpen, handleToggle, handleSelect, handlePrompt, handleRefresh, handleFocusOut, handleClose };
}
// 右下のモデル選択と、その下のプロンプト領域。
const template = `<section class="model-settings ai-accent" aria-label="AI設定"
  @focusout="handleFocusOut" @keydown.esc="handleClose">
  <div class="model-picker">
    <div v-if="isOpen" class="model-options" aria-label="利用可能なモデル">
      <p v-if="!models.length">モデルは未取得です</p>
      <button v-for="model in models" :key="model" type="button" class="text-button" @click="handleSelect(model)">{{ model }}</button>
      <button type="button" class="text-button" :disabled="isBusy" @click="handleRefresh">{{ isBusy ? '取得中…' : 'モデル一覧を取得' }}</button>
    </div>
    <button type="button" class="text-button model-toggle" :aria-expanded="isOpen" @click="handleToggle">{{ currentModel || 'モデルを選択' }} ▴</button>
  </div>
  <label for="system-prompt">システムプロンプト</label>
  <textarea id="system-prompt" :value="systemPrompt" @input="handlePrompt" rows="2" placeholder="AIへの指示を入力…"></textarea>
</section>`;
export default { name, props, emits, setup, template };
