// WBS 120〜130行のフロント側API契約を模擬HTTPで検証する。
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="app"></div>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node']) globalThis[key] = dom.window[key];
const { createApp } = await import('vue');
const { useSheetSession } = await import('../composables/useSheetSession.js');
const { useAppSettings } = await import('../composables/useAppSettings.js');
const { createEmptySheet } = await import('../utils/sheet_format.js');
const requests = [];
const sheet = { id: 's1', title: 'API検証', created_at: '2026-09-09T00:00:00', updated_at: '2026-09-09T00:00:00', ...createEmptySheet() };
let sheetReply = sheet;
let listReply = [{ id: sheet.id, title: sheet.title, updated_at: sheet.updated_at }];
let stateReply = { last_used_model: 'local', user_prompt: '日本語', last_opened_sheet_id: 's1' };
let modelsReply = { data: [{ id: 'local' }, { id: 'other' }] };
let failSave = false;
globalThis.fetch = async (path, options) => {
  const body = options.body === undefined ? undefined : JSON.parse(options.body);
  requests.push({ path, method: options.method, body });
  if (path === '/sheet/s1' && options.method === 'PUT' && failSave) return new Response(JSON.stringify({ error: { code: 'internal_error', message: '保存失敗' } }), { status: 500 });
  let data = { ok: true };
  if (options.method === 'GET') data = ({ '/sheet/s1': sheetReply, '/sheets': listReply, '/state': stateReply, '/models': modelsReply })[path];
  if (path === '/sheet' && options.method === 'POST') data = { id: 's1' };
  if (path === '/ai') data = { title: '要約', note: { title: 'まとめ', body: '本文' } };
  return new Response(JSON.stringify(data));
};
let session;
let settings;
const app = createApp({ setup() { session = useSheetSession(); settings = useAppSettings(); return {}; }, template: '<div></div>' });
app.mount('#app');
try {
  await session.loadSheet('s1');
  assert.equal(session.hasError.value, false);
  assert.equal(session.title.value, sheet.title);
  assert.deepEqual(JSON.parse(JSON.stringify(session.sheetState)), createEmptySheet());
  await session.save();
  assert.deepEqual(requests.find(item => item.method === 'PUT' && item.path === '/sheet/s1').body, { title: sheet.title, ...createEmptySheet() });
  await session.openList();
  assert.equal(session.sheets.value[0].id, 's1');
  assert.equal(await settings.restore(), 's1');
  assert.equal(settings.currentModel.value, 'local');
  assert.equal(settings.systemPrompt.value, '日本語');
  await settings.changeModel('other');
  assert.deepEqual(requests.filter(item => item.path === '/state' && item.method === 'PUT').at(-1).body,
    { last_used_model: 'other', user_prompt: '日本語' });
  await settings.refreshModels();
  assert.deepEqual([...settings.models.value], ['local', 'other']);
  const start = requests.length;
  await session.requestAi({ model_name: 'other', mode: 'note', target_node_id: '', system_prompt: '日本語' });
  assert.equal(session.hasError.value, false);
  const sequence = requests.slice(start);
  assert.equal(sequence.find(item => item.path === '/ai').body.target_node_id, '');
  assert(sequence.findIndex(item => item.path === '/sheet/s1' && item.method === 'PUT') < sequence.findIndex(item => item.path === '/ai'));
  session.rejectProposal();
  await session.requestAi({ model_name: 'other', mode: 'note', target_node_id: 'n0' });
  assert.equal(requests.at(-1).body.target_node_id, 'n0');
  session.rejectProposal();
  for (const target of [undefined, null, 0, 'missing']) {
    const count = requests.length;
    await session.requestAi({ model_name: 'other', mode: 'note', target_node_id: target });
    assert.equal(session.hasError.value, true);
    assert.equal(requests.length, count, '不正な対象IDは保存・AI送信前に拒否');
  }
  failSave = true;
  const aiCount = requests.filter(item => item.path === '/ai').length;
  await session.requestAi({ model_name: 'other', mode: 'note', target_node_id: '' });
  assert.equal(requests.filter(item => item.path === '/ai').length, aiCount);
  failSave = false;
  listReply = { sheets: listReply };
  await session.openList();
  assert.equal(session.hasError.value, true);
  sheetReply = { title: sheet.title, body: createEmptySheet() };
  await session.loadSheet('s1');
  assert.equal(session.hasError.value, true);
  sheetReply = { metadata: { title: sheet.title }, ...createEmptySheet() };
  await session.loadSheet('s1');
  assert.equal(session.hasError.value, true);
  stateReply = { state: stateReply };
  await settings.restore();
  assert.equal(settings.hasError.value, true);
  assert.equal(settings.currentModel.value, 'other', '不正応答で現在の設定を消さない');
  for (const value of [{ models: ['local'] }, ['local'], [{ id: 'local' }], { data: ['local'] }, { data: [null] }]) {
    modelsReply = value;
    await settings.refreshModels();
    assert.equal(settings.hasError.value, true);
  }
  console.log('PASS: フラットなシート送受信・一覧・設定送受信・モデル一覧・AI全体/ノード指定');
  console.log('PASS: AI前保存・保存失敗時中止・対象ID検証・旧ラップ形式のエラー表示');
} finally {
  app.unmount();
  dom.window.close();
}
