// 実際のVueをjsdomでマウントし、編集とAPI境界を検証する。
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:5000/' });
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'WheelEvent']) globalThis[key] = dom.window[key];
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
window.feather = (await import('feather-icons')).default;
const { createApp, nextTick } = await import('vue');
const { default: AppRoot } = await import('../../static/components/AppRoot.js');
const { useSheetSession } = await import('../../static/composables/useSheetSession.js');
const { createEmptySheet, parseSheet } = await import('../../static/utils/sheet_format.js');
const { prepareProposal } = await import('../../static/utils/ai_proposal.js');
const { stepPhysics } = await import('../../static/utils/physics.js');
const { useUndoRedo } = await import('../../static/composables/useUndoRedo.js');
const { useAppSettings } = await import('../../static/composables/useAppSettings.js');
const results = [];
const errors = [];
const requests = [];
let state = { last_used_model: 'local-model', user_prompt: '日本語で提案' };
let stored = {};
let nextId = 0;
let aiResponse;
let failPath = '';
let aiGate;
// HTTP契約を模擬し、リクエスト順序と保存内容を記録する。
globalThis.fetch = async (path, options) => {
  const body = options.body ? JSON.parse(options.body) : undefined;
  requests.push({ path, method: options.method, body });
  if (path === failPath) return new Response(JSON.stringify({ error: { code: 'internal_error', message: 'テスト用通信失敗' } }), { status: 500 });
  if (path === '/state' && options.method === 'GET') return new Response(JSON.stringify(state));
  if (path === '/state') { Object.assign(state, body); return new Response(JSON.stringify(state)); }
  if (path === '/models') return new Response(JSON.stringify({ data: [{ id: 'local-model' }] }));
  if (path === '/sheet') return new Response(JSON.stringify({ id: 'sheet-' + ++nextId }));
  if (path === '/sheets') return new Response(JSON.stringify(Object.entries(stored).map(([id, sheet]) => ({ id, title: sheet.title }))));
  if (path === '/ai') { if (aiGate) await aiGate; return new Response(JSON.stringify(aiResponse)); }
  const id = path.split('/').pop();
  if (options.method === 'PUT') { stored[id] = structuredClone(body); return new Response('{}'); }
  if (options.method === 'DELETE') { delete stored[id]; return new Response(null, { status: 204 }); }
  return new Response(JSON.stringify(stored[id]));
};
const app = createApp(AppRoot);
app.config.errorHandler = error => errors.push(error);
app.config.warnHandler = warning => errors.push(new Error(warning));
const vm = app.mount('#app');
// Vueと非同期イベントをフラッシュする。
async function settle() { await new Promise(resolve => setTimeout(resolve, 0)); await nextTick(); }
// テスト対象要素をクリックして更新を待つ。
async function click(element) { assert(element, 'クリックする要素が必要'); if (element.click) element.click(); else element.dispatchEvent(new MouseEvent('click', { bubbles: true })); await settle(); }
// 入力イベントを発火してVueへ値を渡す。
async function input(element, value, type = 'input') { element.value = value; element.dispatchEvent(new Event(type, { bubbles: true })); await settle(); }
// ラベルでボタンを取得する。
function button(label) { return [...document.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === label); }
// モード選択のUI経由で切り替える。
async function mode(label) { await click(document.querySelector('.mode-hud')); await click(button(label)); }
await settle(); await settle();
assert.equal(vm.isStarting, false);
assert.equal(vm.currentModel, 'local-model');
assert.equal(vm.systemPrompt, '日本語で提案');
assert.equal(vm.canUseAi, true);
assert.equal(document.querySelectorAll('.toolbar-button svg').length, 7);
results.push('設定・モデル一覧の起動時復元、全コンポーネントのマウント');

await input(document.querySelector('.sheet-title'), '実装確認', 'change');
await click(button('Undo'));
assert.equal(vm.title, 'Untitled Sheet');
await click(button('Redo'));
assert.equal(vm.title, '実装確認');
await mode('Add Node');
await click(document.querySelector('.node-button'));
const childId = vm.sheetState.nodes[1].id;
await click(document.querySelectorAll('.node-button')[1]);
const grandchildId = vm.sheetState.nodes[2].id;
await mode('Delete Node');
// design-document.md 4.1: 長押し600msで削除、子孫はサブツリーごと削除する（付け替えではない）。
let childButton = document.querySelectorAll('.node-button')[1];
childButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 50, clientY: 50 }));
await new Promise(resolve => setTimeout(resolve, 50));
window.dispatchEvent(new MouseEvent('pointerup', { button: 0 }));
await new Promise(resolve => setTimeout(resolve, 610));
assert.equal(vm.sheetState.nodes.length, 3, '短いクリックは削除しない');
childButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 50, clientY: 50 }));
await new Promise(resolve => setTimeout(resolve, 620));
await settle();
assert.equal(vm.sheetState.nodes.length, 1, '子孫ノードもサブツリーごと削除される');
assert(!vm.sheetState.nodes.some(node => node.id === grandchildId), '孫ノードも削除されている');
await click(button('Undo'));
assert.equal(vm.sheetState.nodes.length, 3, 'Undoでサブツリーごと復元される');
vm.deleteNode('n0'); await settle();
assert.equal(vm.sheetState.nodes.length, 3);
assert(vm.message.includes('theme'));
results.push('600ms長押し・取消、サブツリー削除、テーマ保護、Undo');

await mode('Join Node');
await click(document.querySelectorAll('.node-button')[0]);
await click(document.querySelectorAll('.node-button')[2]);
assert.equal(vm.sheetState.links.length, 1);
assert(document.querySelector('.edge-hit'));
await click(document.querySelector('.edge-hit'));
await input(document.querySelector('.edit-panel textarea'), '接続コメント');
await click(document.querySelector('.edit-panel button[type="submit"]'));
assert.equal(vm.sheetState.links[0].comment, '接続コメント');
const count = vm.sheetState.links.length;
vm.createLink(grandchildId, 'n0'); await settle();
assert.equal(vm.sheetState.links.length, count);
assert(vm.message.includes('already connected'));
await click(document.querySelector('.edge-hit'));
await click([...document.querySelectorAll('.edit-panel button')].find(item => item.textContent === 'Delete'));
assert.equal(vm.sheetState.links.length, 0);
await click(button('Undo'));
assert.equal(vm.sheetState.links.length, 1);
results.push('接続作成・コメント編集・削除、逆向き重複防止');

await mode('Group Node');
await click(document.querySelectorAll('.node-button')[1]);
await click(button('New Group'));
await input(document.querySelector('.edit-panel input'), 'Group A');
await input(document.querySelector('.edit-panel textarea'), 'Description A');
await click(document.querySelector('.edit-panel button[type="submit"]'));
assert.equal(vm.sheetState.groups.length, 1);
assert.equal(vm.sheetState.groups[0].members[0], childId);
await click(document.querySelectorAll('.node-button')[2]);
await click(button('Group A'));
assert.equal(vm.sheetState.groups[0].members.length, 2);
await click(document.querySelector('.group-title'));
await input(document.querySelector('.edit-panel input'), 'Updated Group');
await click(button('Group Color 2'));
await click(document.querySelector('.edit-panel button[type="submit"]'));
assert.equal(vm.sheetState.groups[0].title, 'Updated Group');
assert.equal(vm.sheetState.groups[0].color, '#f7d4e0');
await click(document.querySelectorAll('.node-button')[1]);
await click(button('Remove from Group'));
assert.deepEqual([...vm.sheetState.groups[0].members], [grandchildId]);
await click(button('Undo'));
assert.equal(vm.sheetState.groups[0].members.length, 2);
results.push('グループ作成・所属・除外・名前/コメント/色編集');

await click(button('Add Note'));
await input(document.querySelector('.note-editor input'), 'Manual Note');
await input(document.querySelector('.note-editor textarea'), 'Body\n<script>text</script>');
await click(document.querySelector('.note-editor button[type="submit"]'));
assert.equal(vm.sheetState.notes.length, 1);
await click(button('Edit note: Manual Note'));
await input(document.querySelector('.note-editor textarea'), 'Edited body');
await click(document.querySelector('.note-editor button[type="submit"]'));
assert.equal(vm.sheetState.notes[0].body, 'Edited body');
await click(button('Delete note: Manual Note'));
assert.equal(vm.sheetState.notes.length, 0);
await click(button('Undo'));
assert.equal(vm.sheetState.notes[0].body, 'Edited body');
results.push('ノートCRUD、改行・テキスト表示、Undo');

// シミュレーションを進め、根の固定、停止、座標の非永続化を確認。
for (let i = 0; i < 1900 && frames.size; i++) {
  const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback());
}
await nextTick();
assert.equal(frames.size, 0);
assert(!('x' in vm.sheetState.nodes[0]));
const bodies = Array.from({ length: 10 }, (_, i) => ({ id: String(i), isRoot: i === 0, x: 0, y: 0, vx: 0, vy: 0, width: 192, height: i === 5 ? 200 : 56 }));
const edges = bodies.slice(1).map(body => ({ a: '0', b: body.id }));
let physical;
for (let i = 0; i < 1800; i++) physical = stepPhysics(bodies, edges);
assert.equal(bodies[0].x, 0);
assert.equal(bodies[0].y, 0);
assert(physical.overlap < 1, `重なり ${physical.overlap}`);
assert(physical.speed < .08, `速度 ${physical.speed}`);
assert(bodies.every(body => Number.isFinite(body.x) && Number.isFinite(body.y)));
results.push('物理配置・重なり解消・長文サイズ・収束停止・根固定');

// AI提案は保存後にのみ要求し、承認までは本文を変更しない。
const original = JSON.stringify(vm.sheetState);
aiResponse = { title: 'AI提案', ops: ['ノードとノートを追加'],
  ghosts: [{ id: 'new1', parent: 'n0', text: '提案ノード' }], removes: [],
  links: [{ a: 'new1', b: childId, comment: '提案接続' }],
  group: { members: ['new1', childId], title: 'AIグループ', comment: 'まとめ' },
  note: { title: 'AIノート', body: '提案本文' } };
const requestStart = requests.length;
await vm.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
await settle();
assert.equal(JSON.stringify(vm.sheetState), original);
assert(vm.proposal);
assert(document.querySelector('.ai-proposed'));
assert(document.querySelector('.ai-edge'));
assert(document.querySelector('.ai-group'));
assert(button('Save').disabled);
const sequence = requests.slice(requestStart);
assert(sequence.findIndex(item => item.method === 'PUT' && item.path.startsWith('/sheet/')) < sequence.findIndex(item => item.path === '/ai'));
const lockedBefore = vm.sheetState.nodes.length;
vm.createNode('n0');
assert.equal(vm.sheetState.nodes.length, lockedBefore);
await click([...document.querySelectorAll('.ai-proposal button')].find(item => item.textContent === 'Reject'));
assert.equal(JSON.stringify(vm.sheetState), original);
await vm.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
await settle();
await click([...document.querySelectorAll('.ai-proposal button')].find(item => item.textContent === 'Approve All'));
assert.equal(vm.sheetState.nodes.length, lockedBefore + 1);
assert(vm.sheetState.notes.some(note => note.title === 'AIノート'));
assert(!vm.sheetState.nodes.some(node => node.id === 'new1'));
parseSheet(vm.sheetState);
await click(button('Undo'));
assert.equal(JSON.stringify(vm.sheetState), original);
await click(button('Redo'));
assert.equal(vm.sheetState.nodes.length, lockedBefore + 1);
results.push('AI前自動保存、差分表示、却下・一括承認、実ID変換、全体Undo/Redo');

// 木構造の破壊、重複、循環、テーマの削除は全体拒否。
const base = createEmptySheet();
base.nodes.push({ id: 'a', parent: 'n0', kind: 'idea', text: 'A' }, { id: 'b', parent: 'n0', kind: 'idea', text: 'B' }, { id: 'c', parent: 'a', kind: 'idea', text: 'C' });
base.links.push({ id: 'l', a: 'a', b: 'b', comment: '' });
base.groups.push({ id: 'g', members: ['a', 'c'], title: 'G', comment: '', color: '#d4e4f7' });
for (const proposal of [
  { removes: ['n0'] }, { ghosts: [{ id: 'new', parent: 'missing', text: '不正' }] },
  { ghosts: [{ id: 'a', parent: 'c', text: '循環' }] },
  { links: [{ a: 'b', b: 'a', comment: '重複' }] },
  { ghosts: [{ id: 'new', parent: 'n0', text: 'A' }, { id: 'new', parent: 'n0', text: 'B' }] },
]) assert.throws(() => prepareProposal(base, { title: '不正', ...proposal }));
const merged = prepareProposal(base, { title: '統合', merge: true, removes: ['a', 'b'], ghosts: [{ id: 'new', parent: 'n0', text: '統合後' }] });
const mergedId = merged.result.nodes.find(node => node.text === '統合後').id;
assert.equal(merged.result.nodes.find(node => node.id === 'c').parent, mergedId);
assert.equal(merged.result.links.length, 0);
assert(merged.result.groups[0].members.includes(mergedId));
parseSheet(merged.result);
// design-document.md 4.1: 削除はサブツリーごと（AI提案のremovesも同様）。子ノード'c'も一緒に消える。
const removed = prepareProposal(base, { title: '削除', removes: ['a'] });
assert(!removed.result.nodes.some(node => node.id === 'a'));
assert(!removed.result.nodes.some(node => node.id === 'c'), 'サブツリーごと削除されるため子ノードも消える');
assert.equal(base.nodes.length, 4, '提案準備は元データを変えない');
const edited = prepareProposal(base, { title: '編集', ghosts: [{ id: 'a', parent: 'n0', text: '更新A' }], removed_links: ['l'] });
assert.equal(edited.result.nodes.find(node => node.id === 'a').text, '更新A');
assert.equal(edited.result.links.length, 0);
results.push('AI不正提案の全体拒否、統合での子・接続・所属整理、既存ノード編集');

// API失敗、保留中のロック、古い提案の拒否。
const session = useSheetSession();
aiResponse = { title: '追加', ghosts: [{ id: 'new', parent: 'n0', text: 'AI' }] };
failPath = '/sheet/anything';
await session.save();
failPath = `/sheet/${session.sheetId.value}`;
const aiCount = requests.filter(item => item.path === '/ai').length;
await session.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
assert.equal(requests.filter(item => item.path === '/ai').length, aiCount);
assert.equal(session.proposal.value, null);
failPath = '';
let release;
aiGate = new Promise(resolve => { release = resolve; });
const pending = session.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
await settle();
session.createNode('n0');
assert.equal(session.sheetState.nodes.length, 1);
release(); await pending; aiGate = null;
session.sheetState.nodes[0].text = '競合した編集';
assert.equal(session.commitProposal(), false);
assert.equal(session.sheetState.nodes.length, 1);
assert.equal(session.proposal.value, null);
results.push('保存失敗時AI中止、非同期処理中の編集ロック、古い提案の拒否');

// JSON入出力、未保存確認、20件履歴。
let blob;
URL.createObjectURL = value => { blob = value; return 'blob:test'; };
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = () => {};
session.exportSheet();
const exported = JSON.parse(await blob.text());
assert(exported.metadata);
assert(!('x' in exported.nodes[0]));
const importBefore = JSON.stringify(session.sheetState);
await session.importSheet({ size: 100, text: async () => JSON.stringify({ metadata: { title: '取込' }, ...base }) });
assert(session.pendingAction.value);
session.cancelSwitch();
assert.equal(JSON.stringify(session.sheetState), importBefore);
await session.importSheet({ size: 100, text: async () => JSON.stringify({ metadata: { title: '取込' }, ...base }) });
session.confirmSwitch();
assert.equal(session.sheetId.value, null);
assert.equal(session.title.value, '取込');
assert.equal(session.canUndo.value, false);
const history = useUndoRedo();
for (let i = 0; i < 25; i++) history.record(String(i), String(i + 1));
for (let i = 25; i > 5; i--) assert.equal(history.undo(String(i)), String(i - 1));
assert.equal(history.canUndo.value, false);
history.record('x', 'y'); assert.equal(history.canRedo.value, false);
results.push('JSON入出力・未保存確認・新規ID・履歴上限');


// 空グループを含めた削除と、所属移動を確認する。
const groupId = vm.sheetState.groups[0].id;
vm.createGroup([childId], 'Move Target', '', '#d4f7e0');
await settle();
assert.equal(vm.sheetState.groups.filter(group => group.members.includes(childId)).length, 1);
vm.excludeGroup(childId);
await settle();
const emptyGroup = vm.sheetState.groups.find(group => group.title === 'Move Target');
assert.equal(emptyGroup.members.length, 0);
await click(button('Edit from group list: Move Target'));
await click([...document.querySelectorAll('.edit-panel button')].find(item => item.textContent === 'Delete'));
assert(!vm.sheetState.groups.some(group => group.id === emptyGroup.id));
await click(button('Undo'));
assert(vm.sheetState.groups.some(group => group.id === emptyGroup.id));
results.push('グループ単一所属・空グループ削除・Undo');

// プロンプト変更をデバウンス保存し、ひとりごとの本文を送信する。
await input(document.querySelector('#system-prompt'), '途中の指示');
await input(document.querySelector('#system-prompt'), '最後の指示');
await new Promise(resolve => setTimeout(resolve, 530));
await settle();
assert.equal(state.user_prompt, '最後の指示');
aiResponse = { title: 'メモの提案', note: { title: 'ひとりごと', body: 'メモの本文' } };
await input(document.querySelector('#mutter-text'), '送信したいアイデア');
document.querySelector('.mutter-input').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await settle(); await settle();
assert(vm.proposal);
const mutterRequest = requests.filter(item => item.path === '/ai').at(-1).body;
assert.equal(mutterRequest.mode, 'mutter');
assert.equal(mutterRequest.text, '送信したいアイデア');
assert.equal(mutterRequest.system_prompt, '最後の指示');
await click([...document.querySelectorAll('.ai-proposal button')].find(item => item.textContent === 'Reject'));
assert.equal(document.querySelector('#mutter-text').value, '送信したいアイデア');

// AIホイールから全体要約とノード対象の選択まで操作する。
async function aiChoice(label) {
  document.querySelector('.sheet-canvas').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2, shiftKey: true, clientX: 400, clientY: 300 }));
  await new Promise(resolve => setTimeout(resolve, 370)); await settle();
  await click(button(label));
}
await aiChoice('Summary');
assert(vm.targetPrompt);
await click([...document.querySelectorAll('.ai-target button')].find(item => item.textContent === 'Summarize Whole Sheet'));
await settle(); await settle();
assert.equal(requests.filter(item => item.path === '/ai').at(-1).body.target_node_id, '');
await click([...document.querySelectorAll('.ai-proposal button')].find(item => item.textContent === 'Reject'));
await mode('View');
await aiChoice('Expand');
let captures = 0;
document.querySelector('.sheet-canvas').setPointerCapture = () => captures++;
document.querySelector('.node-button').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
assert.equal(captures, 0, 'AI対象選択のクリックをパン操作で奪わない');
await click(document.querySelector('.node-button'));
await settle(); await settle();
assert.equal(requests.filter(item => item.path === '/ai').at(-1).body.target_node_id, 'n0');
assert.equal(requests.filter(item => item.path === '/ai').at(-1).body.mode, 'expand');
await click([...document.querySelectorAll('.ai-proposal button')].find(item => item.textContent === 'Reject'));
results.push('設定保存・メモ送信・AIホイール・全体/部分の対象選択');

// 設定保存が遅くても、古い設定が最後の入力を上書きしない。
const originalFetch = globalThis.fetch;
let unblock;
let writes = 0;
globalThis.fetch = async (path, options) => {
  if (path === '/state' && options.method === 'PUT') {
    writes++;
    if (writes === 1) await new Promise(resolve => { unblock = resolve; });
  }
  return originalFetch(path, options);
};
await input(document.querySelector('#system-prompt'), '遅い一回目');
vm.handleSettingsSave(); await settle();
await input(document.querySelector('#system-prompt'), '速い二回目');
vm.handleSettingsSave(); await settle();
assert.equal(writes, 1, '設定保存は直列実行');
unblock(); await settle(); await settle();
assert.equal(writes, 2);
assert.equal(state.user_prompt, '速い二回目');
globalThis.fetch = originalFetch;
results.push('設定の通信競合防止');

// 保存・読込とシート削除は成功応答でのみ反映する。
await vm.save();
const savedId = vm.sheetId;
assert.equal(state.last_opened_sheet_id, savedId);
assert.equal(vm.canUndo, false);
await vm.openList(); await settle();
assert(document.querySelector('.sheet-list-entry'));
await vm.loadSheet(savedId); await settle();
assert.equal(vm.sheetId, savedId);
vm.deleteSheet(savedId); await settle();
assert(vm.pendingAction);
await vm.confirmSwitch(); await settle();
assert.equal(vm.sheetId, null);
assert.equal(state.last_opened_sheet_id, null);
assert(!stored[savedId]);
results.push('保存・読込・最後のシートID更新・確認付きシート削除');

// 仕様書4.4：AI直前の保存でもUndo/Redoを両方消し、承認は新しい1履歴にする。
const saveHistory = useSheetSession();
saveHistory.createNode('n0');
saveHistory.createNode('n0');
saveHistory.undo();
assert.equal(saveHistory.canUndo.value, true);
assert.equal(saveHistory.canRedo.value, true);
const beforeAutoSave = JSON.stringify(saveHistory.sheetState);
aiResponse = { title: '保存後の提案', ghosts: [{ id: 'new-history', parent: 'n0', text: '履歴確認' }] };
let releaseHistory;
aiGate = new Promise(resolve => { releaseHistory = resolve; });
const autoSaving = saveHistory.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
await settle();
assert.equal(saveHistory.isBusy.value, true);
assert.equal(saveHistory.canUndo.value, false, '自動保存成功時点でUndoをリセット');
assert.equal(saveHistory.canRedo.value, false, '自動保存成功時点でRedoをリセット');
releaseHistory();
await autoSaving;
aiGate = null;
assert.equal(saveHistory.commitProposal(), true);
assert.equal(saveHistory.canUndo.value, true, 'AI承認は新しい履歴');
saveHistory.undo();
assert.equal(JSON.stringify(saveHistory.sheetState), beforeAutoSave);
assert.equal(saveHistory.canUndo.value, false, '保存前の履歴へは戻れない');
assert.equal(saveHistory.canRedo.value, true);
saveHistory.redo();
assert(saveHistory.sheetState.nodes.some(node => node.text === '履歴確認'));

// シート保存自体の失敗では、既存のUndo/Redoと編集内容を保持する。
saveHistory.createNode('n0');
saveHistory.undo();
assert.equal(saveHistory.canUndo.value, true);
assert.equal(saveHistory.canRedo.value, true);
const beforeFailedSave = JSON.stringify(saveHistory.sheetState);
failPath = `/sheet/${saveHistory.sheetId.value}`;
await saveHistory.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
assert.equal(saveHistory.canUndo.value, true);
assert.equal(saveHistory.canRedo.value, true);
assert.equal(JSON.stringify(saveHistory.sheetState), beforeFailedSave);

// 保存成功後のAI失敗・却下でも、保存前の履歴を復元しない。
failPath = '/ai';
await saveHistory.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
assert.equal(saveHistory.canUndo.value, false);
assert.equal(saveHistory.canRedo.value, false);
assert.equal(JSON.stringify(saveHistory.sheetState), beforeFailedSave);
failPath = '';
saveHistory.createNode('n0');
await saveHistory.requestAi({ model_name: 'local-model', mode: 'expand', target_node_id: 'n0' });
saveHistory.rejectProposal();
assert.equal(saveHistory.canUndo.value, false);
assert.equal(saveHistory.canRedo.value, false);
results.push('保存成功でUndo/Redoリセット、保存失敗で保持、AI承認を新規履歴化');

// design-document.md 6.4: モードに応じてカーソルを変える（view=grab、他=crosshair）。
{
  await mode('View');
  const canvas = document.querySelector('.sheet-canvas');
  assert.equal(window.getComputedStyle(canvas).cursor, 'grab', 'viewモードはgrabカーソル');
  await mode('Add Node');
  assert.equal(window.getComputedStyle(canvas).cursor, 'crosshair', 'view以外は十字カーソル');
  await mode('View');
  results.push('モード別カーソル表示');
}

// design-document.md 6.2: 画面全体にビネット効果を敷く。
{
  assert(document.querySelector('.vignette'), 'ビネット効果の要素が存在する');
  results.push('ビネット効果');
}

// design-document.md 4.1: マウスホイール操作でもモードホイールを表示する。
{
  document.querySelector('.sheet-canvas').dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));
  await settle();
  assert(document.querySelector('.radial-wheel'), 'マウスホイール操作でモードホイールが表示される');
  await click([...document.querySelectorAll('.wheel-entry')].find(item => item.getAttribute('aria-label') === 'View'));
  results.push('マウスホイールでのモードホイール表示');
}

// design-document.md 4.1: 右クリック長押し→モードホイール表示はほぼ即時（体感できない程度）。
{
  document.querySelector('.sheet-canvas').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX: 300, clientY: 300 }));
  await settle();
  assert(document.querySelector('.radial-wheel'), '右クリック長押しで即座にモードホイールが表示される');
  window.dispatchEvent(new MouseEvent('pointerup', { button: 2 }));
  await settle();
  results.push('右クリック長押しの即時表示');
}

assert.deepEqual(errors, []);
app.unmount();
assert.equal(frames.size, 0, '画面終了後はアニメーション停止');
// 再起動時は最後の保存済みシートを読み込み、履歴は復元しない。
stored.resume = { title: '前回のシート', ...base };
state.last_opened_sheet_id = 'resume';
const resumedApp = createApp(AppRoot);
resumedApp.config.errorHandler = error => errors.push(error);
resumedApp.config.warnHandler = warning => errors.push(new Error(warning));
const resumed = resumedApp.mount('#app');
await settle(); await settle();
assert.equal(resumed.isStarting, false);
assert.equal(resumed.sheetId, 'resume');
assert.equal(resumed.title, '前回のシート');
assert.equal(resumed.sheetState.nodes.length, base.nodes.length);
assert.equal(resumed.canUndo, false);
assert.equal(resumed.currentModel, 'local-model');
resumedApp.unmount();
assert.equal(frames.size, 0);
assert.deepEqual(errors, []);
results.push('前回シートの自動復元と履歴リセット');

// バックエンドが契約通りに応答しない場合のエラーハンドリング。
{
  const settings = useAppSettings();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options) => (path === '/models')
    ? new Response(JSON.stringify({ foo: 'bar' })) : originalFetch(path, options);
  await settings.refreshModels();
  assert.equal(settings.hasError.value, true);
  assert(settings.status.value.includes('model list'), 'GET /models不正形式のエラー文言');
  globalThis.fetch = originalFetch;
}
{
  const settings = useAppSettings();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  await settings.restore();
  assert.equal(settings.hasError.value, true);
  assert(settings.status.value.includes('Failed to restore settings'), 'GET /stateネットワーク障害のエラー文言');
  globalThis.fetch = originalFetch;
}
{
  const session = useSheetSession();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options) => (path === '/sheets')
    ? new Response(JSON.stringify({ sheets: [] })) : originalFetch(path, options);
  await session.openList();
  assert.equal(session.hasError.value, true);
  assert(session.message.value.includes('sheet list'), 'GET /sheets不正形式のエラー文言');
  globalThis.fetch = originalFetch;
}
{
  const session = useSheetSession();
  stored['bad-title'] = { ...base };
  await session.loadSheet('bad-title');
  assert.equal(session.hasError.value, true);
  assert(session.message.value.includes('title'), 'GET /sheetタイトル不正のエラー文言');
}
{
  const session = useSheetSession();
  await session.importSheet({ size: 6 * 1024 * 1024, text: async () => '{}' });
  assert.equal(session.hasError.value, true);
  assert(session.message.value.includes('5MB'), 'インポート最大サイズ超過のエラー文言');
}
{
  const session = useSheetSession();
  await session.importSheet({ size: 10, text: async () => '不正なJSON' });
  assert.equal(session.hasError.value, true, '壊れたJSONのインポートはエラーになる');
}
results.push('API応答不正・ネットワーク障害・不正インポートのエラーハンドリング');

// design-document.md 6.4: 同グループのノードはより引き合い、異なるグループ（無所属含む）はより反発する。
{
  const makeBodies = () => ([
    { id: 'a', isRoot: false, x: -100, y: 0, vx: 0, vy: 0, width: 192, height: 56 },
    { id: 'b', isRoot: false, x: 100, y: 0, vx: 0, vy: 0, width: 192, height: 56 },
  ]);
  const sameGroupBodies = makeBodies();
  const groups = [{ members: ['a', 'b'] }];
  for (let i = 0; i < 60; i++) stepPhysics(sameGroupBodies, [], groups);
  const diffGroupBodies = makeBodies();
  for (let i = 0; i < 60; i++) stepPhysics(diffGroupBodies, [], []);
  const sameDistance = Math.abs(sameGroupBodies[1].x - sameGroupBodies[0].x);
  const diffDistance = Math.abs(diffGroupBodies[1].x - diffGroupBodies[0].x);
  assert(sameDistance < diffDistance, '同グループのノードは無所属時より近づく');
  results.push('グループ内引力・グループ間斥力');
}

console.log(results.map(result => 'PASS: ' + result).join('\n'));
