// AIトランザクションの差分を表示し、一括承認・却下を通知する。
// コンポーネントの識別名。
const name = 'AiProposalPanel';
// 検証済みの提案。
const props = { proposal: { type: Object, required: true } };
// 承認・却下イベント。
const emits = ['commit', 'reject'];
// 操作の通知ハンドラを返す。
function setup(props, { emit }) {
  // トランザクション全体の承認を通知する。
  function handleCommit() { emit('commit'); }
  // トランザクション全体の却下を通知する。
  function handleReject() { emit('reject'); }
  return { handleCommit, handleReject };
}
// 項目のHTMLは解釈せず、テキストとして表示する。
const template = `<section class="ai-proposal ai-accent" aria-label="AI Proposal">
  <h2>{{ proposal.title }}</h2>
  <p class="proposal-count">Nodes {{ proposal.nodes.changed.length }} changed / {{ proposal.nodes.removed.length }} removed /
    Links {{ proposal.links.changed.length }} changed / {{ proposal.links.removed.length }} removed /
    Groups {{ proposal.groups.changed.length }} changed / {{ proposal.groups.removed.length }} removed / Notes {{ proposal.notes.changed.length }}</p>
  <ol v-if="proposal.ops.length"><li v-for="(op, index) in proposal.ops" :key="index">{{ op }}</li></ol>
  <details v-for="note in proposal.result.notes.filter(item => proposal.notes.changed.includes(item.id))" :key="note.id" open>
    <summary>{{ note.title }}</summary><p class="note-body">{{ note.body }}</p></details>
  <div class="edit-actions"><button type="button" class="text-button" @click="handleCommit">Approve All</button>
    <button type="button" class="text-button" @click="handleReject">Reject</button></div>
</section>`;
export default { name, props, emits, setup, template };
