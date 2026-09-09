// 既存テストを変更せず、仕様変更後の期待値とUI検証のマウント状態を補正して実行する。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
let source = await readFile(new URL('../../tests/frontend/run.mjs', import.meta.url), 'utf8');
const previous = "assert.equal(removed.result.nodes.find(node => node.id === 'c').parent, 'n0');";
assert(source.includes(previous), '元テストが更新された場合はAI削除の補正を見直す');
source = source.replace(previous, "assert(!removed.result.nodes.some(node => node.id === 'c'), 'AI提案も子孫を削除');")
  .replace('// design-document.md 6.4: モードに応じてカーソルを変える', `// 元テストのアンマウント後に追加UI検証用のアプリを用意する。
const regressionApp = createApp(AppRoot);
regressionApp.mount('#app');
await settle();
// design-document.md 6.4: モードに応じてカーソルを変える`)
  .replace('console.log(results.map', 'regressionApp.unmount();\nconsole.log(results.map')
  .replaceAll('../../static/', new URL('../', import.meta.url).href);
try { await import('data:text/javascript,' + encodeURIComponent(source)); }
catch (error) {
  console.error(error.stack.replace(/data:text\/javascript,.*:(\d+):(\d+)/g, 'existing-tests:$1:$2'));
  process.exit(1);
}
const { nextNodeId, createEmptySheet } = await import('../utils/sheet_format.js');
const { prepareProposal } = await import('../utils/ai_proposal.js');
const { useWheel } = await import('../composables/useWheel.js');
const { createApp, nextTick } = await import('vue');
assert.equal(nextNodeId([{ id: 'n0' }, { id: 'legacy-uuid' }, { id: 'n12' }]), 'n13');
assert.equal(nextNodeId([{ id: 'n9007199254740993' }]), 'n9007199254740994');
const sheet = createEmptySheet();
sheet.nodes.push({ id: 'n1', parent: 'n0', kind: 'idea', text: '子' }, { id: 'n2', parent: 'n1', kind: 'idea', text: '孫' });
sheet.links.push({ id: 'l1', a: 'n0', b: 'n2', comment: '' });
sheet.groups.push({ id: 'g1', members: ['n1', 'n2'], title: '群', comment: '', color: '#d4e4f7' });
const removed = prepareProposal(sheet, { title: '削除', removes: ['n1', 'n2'] });
assert.deepEqual(removed.nodes.removed, ['n1', 'n2']);
assert.equal(removed.result.links.length, 0);
assert.equal(removed.result.groups[0].members.length, 0);
const added = prepareProposal(sheet, { title: '追加', ghosts: [
  { id: 'new1', parent: 'n0', text: '追加' }, { id: 'new2', parent: 'new1', text: '追加の子' },
] });
assert.equal(added.result.nodes.at(-2).id, 'n3');
assert.equal(added.result.nodes.at(-1).id, 'n4');
assert.equal(added.result.nodes.at(-1).parent, 'n3');
let wheel;
const host = document.createElement('div');
document.body.append(host);
const app = createApp({ setup() { wheel = useWheel(() => 'view'); return {}; }, template: '<div class="sheet-canvas"></div>' });
app.mount(host);
const target = host.firstChild;
wheel.handlePointerDown({ button: 2, target, clientX: 300, clientY: 300, shiftKey: true, preventDefault() {} });
assert.equal(wheel.kind.value, 'ai');
assert.equal(wheel.isOpen.value, true);
wheel.scrollMode({ deltaY: 100, clientX: 300, clientY: 300 });
assert.equal(wheel.kind.value, 'mode');
assert.equal(wheel.selection.value.entry.value, 'add');
window.dispatchEvent(new MouseEvent('pointerup', { button: 2 }));
assert.equal(wheel.isOpen.value, true, '古い右ボタン解除はスクロール選択を閉じない');
wheel.handlePointerDown({ button: 2, target, clientX: 400, clientY: 300, shiftKey: false, preventDefault() {} });
window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 200 }));
assert.equal(wheel.activeIndex.value, 0, '後からの右クリックでポインター選択を再開');
await new Promise(resolve => setTimeout(resolve, 670));
assert.equal(wheel.isOpen.value, true, '古いスクロールタイマーは取り消される');
window.dispatchEvent(new MouseEvent('pointerup', { button: 2 }));
assert.equal(wheel.isOpen.value, false);
app.unmount();
console.log('PASS: 増分ID・AI親子参照・子孫と関連参照の削除・入力競合とタイマー取消');
const css = document.createElement('style');
css.textContent = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
document.head.append(css);
const { default: SheetCanvas } = await import('../components/SheetCanvas.js');
const canvasHost = document.createElement('div');
document.body.append(canvasHost);
const canvasApp = createApp(SheetCanvas, { sheetState: createEmptySheet(), mode: 'view' });
canvasApp.mount(canvasHost);
await nextTick();
const canvas = canvasHost.firstChild;
const theme = canvas.querySelector('.theme-node');
assert.equal(window.getComputedStyle(theme).width, '240px');
assert.equal(window.getComputedStyle(theme.querySelector('button')).minHeight, '72px');
canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
await nextTick();
assert.equal(canvas.style.cursor, 'grabbing');
canvas.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 80 }));
await nextTick();
assert(canvas.style.backgroundPosition.includes('40px'));
assert(canvas.style.backgroundPosition.includes('50px'));
canvas.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
await nextTick();
assert.equal(canvas.style.cursor, 'grab');
canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 }));
await nextTick();
assert(parseFloat(canvas.style.backgroundSize) > 24);
canvasApp.unmount();
const label = document.createElement('span');
label.className = 'wheel-center';
document.body.append(label);
assert.equal(window.getComputedStyle(label).backgroundColor, 'rgba(0, 0, 0, 0)');
label.remove();
console.log('PASS: テーマサイズ・背景のパン/ズーム追従・ドラッグカーソル・背景透過');
