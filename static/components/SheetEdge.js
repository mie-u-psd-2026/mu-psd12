// 直接エッジを実線、間接エッジを破線で描画する。
// コンポーネントの識別名。
const name = 'SheetEdge';
// 両端の表示座標。
const props = {
  type: { type: String, default: 'direct' },
  from: { type: Object, required: true },
  to: { type: Object, required: true },
};
// この描画部品が発火するイベント。
const emits = [];

// 追加の状態を持たない描画部品の設定を返す。
function setup() {
  return {};
}

// ノードの中心同士を、接続種別に応じた線で結ぶ。
const template = `<line :x1="from.x" :y1="from.y" :x2="to.x" :y2="to.y" class="sheet-edge" :class="{ 'is-indirect': type === 'indirect' }" />`;

export default { name, props, emits, setup, template };
