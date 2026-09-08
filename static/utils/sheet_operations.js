// 手動編集とAI提案で共用する、シート本体への操作。
import { GROUP_COLORS } from './sheet_format.js';

// IDを受け取り、存在するノードを返す。
export function findNode(sheet, id) {
  const node = sheet.nodes.find(entry => entry.id === id);
  if (!node) throw new Error('対象のノードがありません。');
  return node;
}

// ノードIDを受け取り、子を親へつなぎ直して対象と関連参照を削除する。
export function removeNode(sheet, id) {
  const node = findNode(sheet, id);
  if (node.parent === null) throw new Error('テーマノードは削除できません。');
  sheet.nodes.forEach(child => { if (child.parent === id) child.parent = node.parent; });
  sheet.nodes = sheet.nodes.filter(entry => entry.id !== id);
  sheet.links = sheet.links.filter(link => link.a !== id && link.b !== id);
  sheet.groups.forEach(group => { group.members = group.members.filter(member => member !== id); });
}

// 端点とコメントを受け取り、重複のない無向エッジを追加する。
export function addLink(sheet, a, b, comment = '') {
  findNode(sheet, a);
  findNode(sheet, b);
  if (a === b) throw new Error('同じノード同士は接続できません。');
  if (sheet.links.some(link => (link.a === a && link.b === b) || (link.a === b && link.b === a))) {
    throw new Error('このノード同士は既に接続されています。');
  }
  sheet.links.push({ id: crypto.randomUUID(), a, b, comment });
}

// メンバーID一覧を受け取り、既存の所属から取り除く。
export function detachMembers(sheet, members) {
  const selected = new Set(members);
  sheet.groups.forEach(group => { group.members = group.members.filter(id => !selected.has(id)); });
}

// メンバー、タイトル、コメント、色を受け取り、グループを追加する。
export function addGroup(sheet, members, title, comment, color) {
  if (!title.trim()) throw new Error('グループ名を入力してください。');
  if (!members.length) throw new Error('グループに追加するノードを選択してください。');
  members.forEach(id => findNode(sheet, id));
  detachMembers(sheet, members);
  sheet.groups.push({ id: crypto.randomUUID(), members: [...new Set(members)], title: title.trim(),
    comment, color: GROUP_COLORS.includes(color) ? color : GROUP_COLORS[sheet.groups.length % GROUP_COLORS.length] });
}

// ノードを既存グループへ移し、複数所属を防ぐ。
export function moveToGroup(sheet, nodeId, groupId) {
  findNode(sheet, nodeId);
  const group = sheet.groups.find(entry => entry.id === groupId);
  if (!group) throw new Error('対象のグループがありません。');
  detachMembers(sheet, [nodeId]);
  group.members.push(nodeId);
}

// 複数ノードを指定されたノードへ統合し、子・エッジ・所属をつなぎ直す。
export function mergeNodes(sheet, ids, merged) {
  const selected = new Set(ids);
  if (selected.size < 2) throw new Error('統合には2つ以上のノードが必要です。');
  const sources = ids.map(id => findNode(sheet, id));
  if (sources.some(node => node.parent === null)) throw new Error('テーマノードは統合できません。');
  if (sheet.nodes.some(node => node.id === merged.id)) throw new Error('統合先IDが重複しています。');
  let parent = merged.parent;
  const visited = new Set();
  while (selected.has(parent)) {
    if (visited.has(parent)) throw new Error('統合先の親子関係が不正です。');
    visited.add(parent);
    parent = findNode(sheet, parent).parent;
  }
  findNode(sheet, parent);
  sheet.nodes = sheet.nodes.filter(node => !selected.has(node.id));
  sheet.nodes.forEach(node => { if (selected.has(node.parent)) node.parent = merged.id; });
  sheet.nodes.push({ ...merged, parent, kind: 'idea' });
  const pairs = new Set();
  sheet.links = sheet.links.map(link => ({ ...link, a: selected.has(link.a) ? merged.id : link.a,
    b: selected.has(link.b) ? merged.id : link.b })).filter(link => {
    const pair = JSON.stringify([link.a, link.b].sort());
    if (link.a === link.b || pairs.has(pair)) return false;
    pairs.add(pair);
    return true;
  });
  const owner = sheet.groups.find(group => group.members.some(id => selected.has(id)));
  detachMembers(sheet, ids);
  if (owner) owner.members.push(merged.id);
}
