// シート本体を保持し、ノードの追加とテキスト更新を提供する。
import { reactive } from 'vue';
import { createEmptySheet, nextNodeId } from '../utils/sheet_format.js';

// 初期シートと、木構造を維持する編集関数を返す。
export function useSheetState() {
  const sheetState = reactive(createEmptySheet());

  // 親IDを受け取り、存在する親に子ノードを追加してそのIDを返す。
  function addNode(parentId) {
    if (!sheetState.nodes.some(node => node.id === parentId)) return null;

    const id = nextNodeId(sheetState.nodes);
    sheetState.nodes.push({ id, kind: 'idea', text: 'New Idea', parent: parentId });
    return id;
  }

  // ノードIDと文字列を受け取り、空白のみの入力を除いて更新する。
  function updateNodeText(id, text) {
    if (typeof text !== 'string' || !text.trim()) return;

    const node = sheetState.nodes.find(node => node.id === id);
    if (!node) return;

    node.text = text.trim();
  }

  return { sheetState, addNode, updateNodeText };
}
