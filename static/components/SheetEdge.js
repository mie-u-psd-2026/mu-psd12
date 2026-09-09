// 接続の線と、編集用の広いクリック領域を描画する。
// コンポーネントの識別名。
const name = 'SheetEdge';
// 接続の座標、種別、編集状態。
const props = { from: { type: Object, required: true }, to: { type: Object, required: true },
  type: { type: String, default: 'direct' }, link: Object, canEdit: Boolean, isChanged: Boolean, isRemoved: Boolean };
// 編集対象とクリック位置の通知。
const emits = ['editRequested'];
// 編集ハンドラを返す。
function setup(props, { emit }) {
  // 接続が編集可能な場合、対象とクリック位置を親へ通知する。
  function handleEdit(event) { if (props.canEdit) emit('editRequested', props.link, event); }
  return { handleEdit };
}
// 線本体と透明なクリック領域を重ねる。
const template = `<g v-if="from && to">
  <line :x1="from.x" :y1="from.y" :x2="to.x" :y2="to.y" class="sheet-edge"
    :class="{ 'is-indirect': type === 'indirect', 'ai-edge': isChanged || isRemoved, 'is-removed': isRemoved }" />
  <line v-if="canEdit" :x1="from.x" :y1="from.y" :x2="to.x" :y2="to.y" class="edge-hit"
    role="button" tabindex="0" :aria-label="'Edit link: ' + (link.comment || 'no comment')"
    @click.stop="handleEdit" @keydown.enter.prevent="handleEdit"><title>{{ link.comment || 'Edit link' }}</title></line>
</g>`;
export default { name, props, emits, setup, template };
