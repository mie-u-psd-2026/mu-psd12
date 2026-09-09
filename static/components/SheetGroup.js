// グループの背景と、編集可能なタイトルを表示する。
import { computed } from 'vue';
// コンポーネントの識別名。
const name = 'SheetGroup';
// メンバーの座標と編集・提案状態。
const props = { group: { type: Object, required: true }, positions: { type: Object, required: true },
  canEdit: Boolean, isChanged: Boolean, isRemoved: Boolean };
// タイトル選択を親へ通知する。
const emits = ['editRequested'];
// 実測サイズを含めた外接領域と編集ハンドラを返す。
function setup(props, { emit }) {
  const bounds = computed(() => {
    const points = props.group.members.map(id => props.positions[id]).filter(Boolean);
    if (!points.length) return null;
    const x = Math.min(...points.map(point => point.x - (point.width || 192) / 2)) - 24;
    const y = Math.min(...points.map(point => point.y - (point.height || 56) / 2)) - 24;
    return { x, y, width: Math.max(...points.map(point => point.x + (point.width || 192) / 2)) + 24 - x,
      height: Math.max(...points.map(point => point.y + (point.height || 56) / 2)) + 24 - y };
  });
  // グループが編集可能なら、対象と位置を親へ通知する。
  function handleEdit(event) { if (props.canEdit) emit('editRequested', props.group, event); }
  return { bounds, handleEdit };
}
// タイトルをクリックして編集し、背景はノード操作を妨げない。
const template = `<g v-if="bounds" :class="{ 'is-removed': isRemoved }">
  <rect v-bind="bounds" rx="32" :fill="group.color" class="sheet-group" :class="{ 'ai-group': isChanged || isRemoved }" />
  <text :x="bounds.x + 16" :y="bounds.y - 8" class="group-title" :class="{ 'can-edit': canEdit }"
    :role="canEdit ? 'button' : null" :tabindex="canEdit ? 0 : null" :aria-label="'Edit group: ' + group.title"
    @click.stop="handleEdit" @keydown.enter.prevent="handleEdit">{{ group.title }}<title>{{ group.comment }}</title></text>
</g>`;
export default { name, props, emits, setup, template };
