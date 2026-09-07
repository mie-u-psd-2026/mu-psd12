// シート内のノートを一覧で表示する。
// コンポーネントの識別名。
const name = 'NotesPanel';
// シートから渡されるノート一覧。
const props = { notes: { type: Array, default: () => [] } };
// 通知イベントは持たない。
const emits = [];
// 追加の状態を持たない描画設定を返す。
function setup() { return {}; }
// 境界線のない常設ノート一覧。
const template = `<section class="notes-panel" aria-label="ノート"><h2>ノート</h2>
  <p v-if="!notes.length" class="muted">ノートはまだありません</p>
  <details v-for="note in notes" :key="note.id"><summary>{{ note.title }}</summary><p class="note-body">{{ note.body }}</p></details>
</section>`;
export default { name, props, emits, setup, template };
