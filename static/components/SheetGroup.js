// グループのメンバーノードの背後に半透明の領域を描く。
import { computed } from 'vue';
// コンポーネントの識別名。
const name = 'SheetGroup';
// グループ本体と一時的なノード座標。
const props = { group: { type: Object, required: true }, positions: { type: Object, required: true } };
// 描画のみのため通知は持たない。
const emits = [];
// メンバーの外接領域を計算して返す。
function setup(props) {
  const bounds = computed(() => {
    const points = props.group.members.map(id => props.positions[id]).filter(Boolean);
    if (!points.length) return null;
    const left = Math.min(...points.map(point => point.x)) - 112;
    const top = Math.min(...points.map(point => point.y)) - 48;
    return { x: left, y: top, width: Math.max(...points.map(point => point.x)) + 112 - left,
      height: Math.max(...points.map(point => point.y)) + 48 - top };
  });
  return { bounds };
}
// ノードの背後にパステル色の背景を表示する。
const template = `<g v-if="bounds"><rect v-bind="bounds" rx="32" :fill="group.color" class="sheet-group" />
  <text :x="bounds.x + 16" :y="bounds.y - 8" fill="#4a4a4a" font-size="12">{{ group.title }}</text></g>`;
export default { name, props, emits, setup, template };
