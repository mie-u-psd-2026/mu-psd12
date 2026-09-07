// 直近20操作を、JSONスナップショット単位で保持する。
import { computed, ref } from 'vue';
// 履歴の最大件数。
const HISTORY_LIMIT = 20;

// 履歴の記録、移動、リセットを行う関数と操作可否を返す。
export function useUndoRedo() {
  const past = ref([]);
  const future = ref([]);
  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  // 変更前後のJSONを受け取り、実際に変化した操作だけ記録する。
  function record(before, after) {
    if (before === after) return;
    past.value.push(before);
    if (past.value.length > HISTORY_LIMIT) past.value.shift();
    future.value = [];
  }

  // 現在のJSONをRedo側に保持し、戻り先を返す。
  function undo(current) {
    if (!canUndo.value) return null;
    future.value.push(current);
    return past.value.pop();
  }

  // 現在のJSONをUndo側に保持し、やり直し先を返す。
  function redo(current) {
    if (!canRedo.value) return null;
    past.value.push(current);
    return future.value.pop();
  }

  // シートの切替・保存時に履歴を空にする。
  function reset() {
    past.value = [];
    future.value = [];
  }
  return { canUndo, canRedo, record, undo, redo, reset };
}
