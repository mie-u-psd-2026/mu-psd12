// 手動編集とAI提案で共用する、シート本体への操作。
import { GROUP_COLORS } from './sheet_format.js';

// IDを受け取り、存在するノードを返す。
export function findNode(sheet, id) {
  const node = sheet.nodes.find(entry => entry.id === id);
  if (!node) throw new Error('The target node does not exist.');
  return node;
}

// ノードIDを受け取り、子孫と接続・所属をまとめて削除する。
export function removeNode(sheet, id) {
  const node = findNode(sheet, id);
  if (node.parent === null) throw new Error('The theme node cannot be deleted.');
  const children = new Map();
  sheet.nodes.forEach(entry => {
    if (!children.has(entry.parent)) children.set(entry.parent, []);
    children.get(entry.parent).push(entry.id);
  });
  const removed = new Set();
  const pending = [id];
  while (pending.length) {
    const current = pending.pop();
    if (removed.has(current)) continue;
    removed.add(current);
    pending.push(...(children.get(current) || []));
  }
  sheet.nodes = sheet.nodes.filter(entry => !removed.has(entry.id));
  sheet.links = sheet.links.filter(link => !removed.has(link.a) && !removed.has(link.b));
  sheet.groups.forEach(group => { group.members = group.members.filter(member => !removed.has(member)); });
}

// 端点とコメントを受け取り、重複のない無向エッジを追加する。コメントは必須（parseSheetで検証）。
export function addLink(sheet, a, b, comment) {
  findNode(sheet, a);
  findNode(sheet, b);
  if (a === b) throw new Error('Cannot connect a node to itself.');
  if (sheet.links.some(link => (link.a === a && link.b === b) || (link.a === b && link.b === a))) {
    throw new Error('These nodes are already connected.');
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
  if (!title.trim()) throw new Error('Please enter a group name.');
  if (!members.length) throw new Error('Please select nodes to add to the group.');
  members.forEach(id => findNode(sheet, id));
  detachMembers(sheet, members);
  sheet.groups.push({ id: crypto.randomUUID(), members: [...new Set(members)], title: title.trim(),
    comment, color: GROUP_COLORS.includes(color) ? color : GROUP_COLORS[sheet.groups.length % GROUP_COLORS.length] });
}

// ノードを既存グループへ移し、複数所属を防ぐ。
export function moveToGroup(sheet, nodeId, groupId) {
  findNode(sheet, nodeId);
  const group = sheet.groups.find(entry => entry.id === groupId);
  if (!group) throw new Error('The target group does not exist.');
  detachMembers(sheet, [nodeId]);
  group.members.push(nodeId);
}

// 複数ノードを指定されたノードへ統合し、子・エッジ・所属をつなぎ直す。
export function mergeNodes(sheet, ids, merged) {
  const selected = new Set(ids);
  if (selected.size < 2) throw new Error('At least two nodes are required to merge.');
  const sources = ids.map(id => findNode(sheet, id));
  if (sources.some(node => node.parent === null)) throw new Error('The theme node cannot be merged.');
  if (sheet.nodes.some(node => node.id === merged.id)) throw new Error('The merge target ID is already in use.');
  let parent = merged.parent;
  const visited = new Set();
  while (selected.has(parent)) {
    if (visited.has(parent)) throw new Error('The merge target has an invalid parent/child relationship.');
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
