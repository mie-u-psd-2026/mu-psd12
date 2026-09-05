// ============================================================
// プレースホルダーファイル。
// 実装時には、このコメントを含む全てのプレースホルダーコメントを削除すること。
// ============================================================
// シートのパン・ズームと、モード別の左クリック操作を統括する（4.1）。
// ノード/エッジ/グループ自体の描画は SheetNode / SheetEdge / SheetGroup に委譲する。

// import SheetNode from './SheetNode.js';
// import SheetEdge from './SheetEdge.js';
// import SheetGroup from './SheetGroup.js';
// import RadialWheel from './RadialWheel.js';
// import { usePhysicsSimulation } from '../composables/usePhysicsSimulation.js';
// import { useWheel } from '../composables/useWheel.js';

const name = 'SheetCanvas';

const props = {
  // TODO: sheetState（nodes/links/groups）
};

const emits = [
  // TODO: 'request-ai' 等、AI機能発火の通知
];

function setup(props, { emit }) {
  // TODO: 左クリック / マウスホイール（モード切替） / Ctrl+ホイール（ズーム）
  // TODO: 右クリック長押し（モードホイール） / 長押し中Shift（AIホイール）
  // TODO: view/add/remove/edit/join/group 各モードの操作（4.1）
  return {};
}

const template = ``;

export default { name, props, emits, setup, template };
