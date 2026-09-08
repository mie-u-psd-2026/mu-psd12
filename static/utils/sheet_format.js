// JSON入出力と履歴で共用するシートの検証・正規化。
// インポートで許可するグループの色。
export const GROUP_COLORS = ['#d4e4f7', '#f7d4e0', '#d4f7e0', '#f7f0d4', '#e4d4f7'];

// 空のシート本体を新しく作成して返す。
export function createEmptySheet() {
  return { nodes: [{ id: 'n0', kind: 'theme', text: 'メインテーマ', parent: null }],
    links: [], groups: [], notes: [] };
}

// 任意の値を受け取り、文字列でなければ入力エラーを投げる。
function requireText(value) {
  if (typeof value !== 'string') throw new Error('文字列でない項目が含まれています。');
  return value;
}

// 要素配列を受け取り、有効な一意IDの集合を返す。
function collectIds(entries) {
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) {
      throw new Error('IDが空、重複、または不正です。');
    }
    ids.add(entry.id);
  }
  return ids;
}

// 外部シートを検証し、座標等の余分なフィールドを除いた本体を返す。
export function parseSheet(value) {
  if (!value || !['nodes', 'links', 'groups', 'notes'].every(key => Array.isArray(value[key]))) {
    throw new Error('nodes・links・groups・notesの配列が必要です。');
  }
  const ids = collectIds(value.nodes);
  const roots = value.nodes.filter(node => node.parent === null);
  if (roots.length !== 1 || roots[0].kind !== 'theme') throw new Error('テーマノードは1つ必要です。');
  const nodes = value.nodes.map(node => {
    if (node.parent !== null && (!ids.has(node.parent) || node.kind !== 'idea')) {
      throw new Error('ノードの親または種別が不正です。');
    }
    return { id: node.id, kind: node.kind, text: requireText(node.text), parent: node.parent };
  });
  const parents = new Map(nodes.map(node => [node.id, node.parent]));
  for (const node of nodes) {
    const visited = new Set();
    let id = node.id;
    while (id !== null) {
      if (visited.has(id)) throw new Error('親子関係が循環しています。');
      visited.add(id);
      id = parents.get(id);
    }
  }
  collectIds(value.links);
  collectIds(value.groups);
  collectIds(value.notes);
  const pairs = new Set();
  const links = value.links.map(link => {
    if (!ids.has(link.a) || !ids.has(link.b) || link.a === link.b) throw new Error('接続先が不正です。');
    const pair = JSON.stringify([link.a, link.b].sort());
    if (pairs.has(pair)) throw new Error('接続が重複しています。');
    pairs.add(pair);
    return { id: link.id, a: link.a, b: link.b, comment: requireText(link.comment) };
  });
  const assigned = new Set();
  const groups = value.groups.map(group => {
    if (!Array.isArray(group.members)) throw new Error('グループのメンバーが不正です。');
    for (const id of group.members) {
      if (!ids.has(id) || assigned.has(id)) throw new Error('グループの所属が重複または不正です。');
      assigned.add(id);
    }
    return { id: group.id, members: [...group.members], title: requireText(group.title),
      comment: requireText(group.comment), color: GROUP_COLORS.includes(group.color) ? group.color : GROUP_COLORS[0] };
  });
  const notes = value.notes.map(note => ({ id: note.id, title: requireText(note.title), body: requireText(note.body) }));
  return { nodes, links, groups, notes };
}
