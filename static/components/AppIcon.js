// 固定バージョンのFeather IconsからSVGを表示する共通部品。
import { computed } from 'vue';
// コンポーネントの識別名。
const name = 'AppIcon';
// アイコン名と、CDNが利用できない場合の代替文字列。
const props = { icon: { type: String, required: true }, label: { type: String, default: '' } };
// 通知イベントは持たない。
const emits = [];

// アイコン名に対応する信頼済みSVGを返す。
function setup(props) {
  const svg = computed(() => window.feather?.icons[props.icon]?.toSvg({
    width: 20, height: 20, 'aria-hidden': 'true', focusable: 'false',
  }) ?? '');
  return { svg };
}
// 外部入力のHTMLは描画せず、ライブラリ生成のSVGだけを使う。
const template = `<span v-if="svg" class="app-icon" v-html="svg"></span><span v-else>{{ label }}</span>`;
export default { name, props, emits, setup, template };
