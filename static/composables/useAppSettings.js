// モデルとシステムプロンプトを復元し、設定更新を順番に保存する。
import { ref, onBeforeUnmount } from 'vue';
import { useApiClient } from './useApiClient.js';

// 設定の状態と、取得・更新・保存待ち合わせの処理を返す。
export function useAppSettings() {
  const api = useApiClient();
  const models = ref([]);
  const currentModel = ref('');
  const systemPrompt = ref('');
  const isModelsBusy = ref(false);
  const status = ref('');
  const hasError = ref(false);
  let timer;
  let queue = Promise.resolve();
  let saved = '';

  // モデル一覧のJSONを受け取り、モデル名の配列を返す。
  function parseModels(data) {
    const entries = Array.isArray(data) ? data : data?.data;
    if (!Array.isArray(entries)) throw new Error('モデル一覧の応答形式が不正です。');
    const result = entries.map(entry => typeof entry === 'string' ? entry : entry?.id);
    if (result.some(entry => typeof entry !== 'string' || !entry)) throw new Error('モデル名が不正です。');
    return [...new Set(result)];
  }

  // インストール済みモデルを取得し、選択値を保持する。
  async function refreshModels() {
    if (isModelsBusy.value) return;
    isModelsBusy.value = true;
    try {
      models.value = parseModels(await api.getModels());
      hasError.value = false;
      status.value = models.value.length ? '' : '利用可能なモデルがありません。';
    } catch (err) { status.value = err.message; hasError.value = true; }
    finally { isModelsBusy.value = false; }
  }

  // 保存済み設定を取得し、最後に開いたシートIDを返す。
  async function restore() {
    try {
      const state = await api.getState();
      if (!state || Array.isArray(state) || typeof state !== 'object') throw new Error('設定の応答形式が不正です。');
      currentModel.value = typeof state.last_used_model === 'string' ? state.last_used_model : '';
      systemPrompt.value = typeof state.user_prompt === 'string' ? state.user_prompt : '';
      saved = JSON.stringify({ last_used_model: currentModel.value, user_prompt: systemPrompt.value });
      return typeof state.last_opened_sheet_id === 'string' ? state.last_opened_sheet_id : null;
    } catch (err) { status.value = `設定を復元できませんでした。${err.message}`; hasError.value = true; return null; }
  }

  // 最新設定を順番に保存し、古い通信が新しい値を上書きしないようにする。
  async function flush() {
    clearTimeout(timer);
    const data = { last_used_model: currentModel.value, user_prompt: systemPrompt.value };
    const encoded = JSON.stringify(data);
    const operation = queue.catch(() => {}).then(async () => {
      if (encoded === saved) return;
      await api.updateState(data);
      saved = encoded;
    });
    queue = operation;
    try { await operation; status.value = '設定を保存しました。'; hasError.value = false; return true; }
    catch (err) { status.value = `設定を保存できませんでした。${err.message}`; hasError.value = true; return false; }
  }

  // モデル選択を更新し、設定を保存する。
  function changeModel(value) {
    currentModel.value = value;
    return flush();
  }

  // 入力中のプロンプトを更新し、連続入力後にまとめて保存する。
  function changePrompt(value) {
    systemPrompt.value = value;
    status.value = '設定は未保存です。';
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }
  onBeforeUnmount(() => clearTimeout(timer));
  return { models, currentModel, systemPrompt, isModelsBusy, status, hasError,
    restore, refreshModels, changeModel, changePrompt, flush };
}
