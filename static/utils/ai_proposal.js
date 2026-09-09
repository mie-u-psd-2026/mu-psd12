// バックエンドで解析済みのJSON提案を検証し、一括適用用のシートを作る。
import { parseSheet, GROUP_COLORS, nextNodeId } from './sheet_format.js';
import { removeNode, mergeNodes, detachMembers } from './sheet_operations.js';

// 任意項目を配列として検証し、未指定の場合は空配列を返す。
function readArray(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('The AI proposal array format is invalid.');
  return value;
}

// 同一種類のデータ同士を比較し、追加・変更・削除のIDを返す。
function compareEntries(before, after) {
  const original = new Map(before.map(entry => [entry.id, entry]));
  const result = new Map(after.map(entry => [entry.id, entry]));
  return {
    changed: after.filter(entry => JSON.stringify(original.get(entry.id)) !== JSON.stringify(entry)).map(entry => entry.id),
    removed: before.filter(entry => !result.has(entry.id)).map(entry => entry.id),
  };
}

// 元のシートと解析済み提案を受け取り、検証済みの結果と強調表示用の差分を返す。
export function prepareProposal(sheet, proposal) {
  if (!proposal || typeof proposal.title !== 'string') throw new Error('The AI proposal title is invalid.');
  if (proposal.merge !== undefined && typeof proposal.merge !== 'boolean') throw new Error('The AI merge flag is invalid.');
  const before = parseSheet(sheet);
  const after = parseSheet(sheet);
  const ghosts = readArray(proposal.ghosts);
  const removes = readArray(proposal.removes);
  const ops = readArray(proposal.ops);
  if (ops.some(op => typeof op !== 'string') || removes.some(id => typeof id !== 'string')) throw new Error('An AI proposal item is invalid.');
  if (new Set(removes).size !== removes.length) throw new Error('A removal target is duplicated.');
  const aliases = new Map();
  const existing = new Set(after.nodes.map(node => node.id));
  const allocated = [...after.nodes];
  for (const ghost of ghosts) {
    if (!ghost || typeof ghost.id !== 'string' || !ghost.id || aliases.has(ghost.id)) throw new Error('An AI node ID is invalid.');
    const id = existing.has(ghost.id) ? ghost.id : nextNodeId(allocated);
    aliases.set(ghost.id, id);
    allocated.push({ id });
  }
  const mapped = ghosts.map(ghost => ({ id: aliases.get(ghost.id), kind: ghost.parent === null ? 'theme' : 'idea',
    text: ghost.text, parent: aliases.get(ghost.parent) || ghost.parent }));
  if (proposal.merge) {
    if (mapped.length !== 1) throw new Error('Exactly one merge target node is required.');
    mergeNodes(after, removes, mapped[0]);
  } else {
    // 削除後の親の解決を検証できるよう、追加と編集を先に反映する。
    for (const node of mapped) {
      const index = after.nodes.findIndex(entry => entry.id === node.id);
      if (index < 0) after.nodes.push(node);
      else after.nodes[index] = node;
    }
    if (removes.some(id => !after.nodes.some(node => node.id === id))) throw new Error('A node to remove does not exist.');
    removes.forEach(id => { if (after.nodes.some(node => node.id === id)) removeNode(after, id); });
  }
  // 接続・グループの削除IDは解析済みJSONの任意フィールドで受け取る。
  for (const id of readArray(proposal.removed_links)) {
    if (!after.links.some(link => link.id === id)) throw new Error('A link to remove does not exist.');
    after.links = after.links.filter(link => link.id !== id);
  }
  for (const id of readArray(proposal.removed_groups)) {
    if (!after.groups.some(group => group.id === id)) throw new Error('A group to remove does not exist.');
    after.groups = after.groups.filter(group => group.id !== id);
  }
  for (const link of readArray(proposal.links)) {
    if (!link) throw new Error('An AI proposal link is invalid.');
    const value = { id: link.id || crypto.randomUUID(), a: aliases.get(link.a) || link.a,
      b: aliases.get(link.b) || link.b, comment: link.comment ?? '' };
    const index = after.links.findIndex(entry => entry.id === value.id);
    if (index < 0) after.links.push(value);
    else after.links[index] = value;
  }
  if (proposal.group) {
    const group = proposal.group;
    const members = readArray(group.members).map(id => aliases.get(id) || id);
    if (!members.length) throw new Error('The AI group has no members.');
    detachMembers(after, members);
    const value = { id: group.id || crypto.randomUUID(), members, title: group.title,
      comment: group.comment ?? '', color: group.color || GROUP_COLORS[after.groups.length % GROUP_COLORS.length] };
    const index = after.groups.findIndex(entry => entry.id === value.id);
    if (index < 0) after.groups.push(value);
    else after.groups[index] = value;
  }
  if (proposal.note) {
    const note = proposal.note;
    after.notes.push({ id: crypto.randomUUID(), title: note.title, body: note.body });
  }
  const result = parseSheet(after);
  if (JSON.stringify(before) === JSON.stringify(result)) throw new Error('The proposal contains no applicable changes.');
  return { title: proposal.title, ops, result, nodes: compareEntries(before.nodes, result.nodes),
    links: compareEntries(before.links, result.links), groups: compareEntries(before.groups, result.groups),
    notes: compareEntries(before.notes, result.notes) };
}
