// 空のグループも含めて一覧にし、編集・削除へアクセスできるようにする。
// コンポーネントの識別名。
const name = 'GroupListPanel';
// グループ一覧と操作の可否。
const props = { groups: { type: Array, default: () => [] }, isLocked: Boolean };
// 選択したグループとクリック位置。
const emits = ['edit'];
// 編集操作の通知ハンドラを返す。
function setup(props, { emit }) {
  // グループを受け取り、編集パネルの表示を要求する。
  function handleEdit(group, event) { emit('edit', 'group', group, event); }
  return { handleEdit };
}
// メンバー0件のグループも削除・名称変更できる一覧。
const template = `<section class="group-list" aria-label="Group List"><h2>Group</h2>
  <p v-if="!groups.length" class="muted">Select any node to create group.</p>
  <button v-for="group in groups" :key="group.id" type="button" class="text-button" :disabled="isLocked"
    :aria-label="'Edit from group list: ' + group.title" @click="handleEdit(group, $event)">
    <span class="group-dot" :style="{ backgroundColor: group.color }"></span>{{ group.title }} ({{ group.members.length }})</button>
</section>`;
export default { name, props, emits, setup, template };
