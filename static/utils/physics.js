// ノード間の斥力、ばね力、矩形衝突を計算する物理ステップ。
// 表示上の最小余白。
const NODE_GAP = 24;

// ノード配列と接続を受け取り、座標と速度を1ステップ更新して最大速度・重なりを返す。
export function stepPhysics(bodies, edges, groups = []) {
  const forces = bodies.map(() => ({ x: 0, y: 0 }));
  const indexes = new Map(bodies.map((body, index) => [body.id, index]));
  const membership = new Map();
  groups.forEach((group, index) => group.members.forEach(id => membership.set(id, index)));
  let overlap = 0;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      let x = b.x - a.x;
      let y = b.y - a.y;
      if (Math.abs(x) + Math.abs(y) < .01) { x = i % 2 ? 1 : -1; y = 1; }
      const distance = Math.max(1, Math.hypot(x, y));
      const isSameGroup = membership.has(a.id) && membership.get(a.id) === membership.get(b.id);
      const repulsion = Math.min(12, 24000 / (distance * distance)) * (isSameGroup ? .7 : 1.4);
      const attraction = isSameGroup ? Math.max(0, distance - Math.max(160, (a.width + b.width) / 2 + NODE_GAP)) * .012 : 0;
      const force = repulsion - attraction;
      forces[i].x -= x / distance * force;
      forces[i].y -= y / distance * force;
      forces[j].x += x / distance * force;
      forces[j].y += y / distance * force;
      const ox = (a.width + b.width) / 2 + NODE_GAP - Math.abs(x);
      const oy = (a.height + b.height) / 2 + NODE_GAP - Math.abs(y);
      if (ox <= 0 || oy <= 0) continue;
      // 収束判定は余白ではなく、ノードの実寸の重なりを使う。
      overlap = Math.max(overlap, Math.min(ox, oy) - NODE_GAP);
      const shift = Math.min(ox, oy) * .35;
      if (ox < oy) { forces[i].x -= Math.sign(x || 1) * shift; forces[j].x += Math.sign(x || 1) * shift; }
      else { forces[i].y -= Math.sign(y || 1) * shift; forces[j].y += Math.sign(y || 1) * shift; }
    }
  }
  for (const edge of edges) {
    const i = indexes.get(edge.a);
    const j = indexes.get(edge.b);
    if (i === undefined || j === undefined) continue;
    const x = bodies[j].x - bodies[i].x;
    const y = bodies[j].y - bodies[i].y;
    const distance = Math.max(1, Math.hypot(x, y));
    const length = Math.max(240, (bodies[i].width + bodies[j].width) / 2 + 64);
    const force = (distance - length) * (edge.isIndirect ? .003 : .018);
    forces[i].x += x / distance * force;
    forces[i].y += y / distance * force;
    forces[j].x -= x / distance * force;
    forces[j].y -= y / distance * force;
  }
  let speed = 0;
  bodies.forEach((body, index) => {
    if (body.isRoot) { body.x = 0; body.y = 0; body.vx = 0; body.vy = 0; return; }
    body.vx = Math.max(-16, Math.min(16, (body.vx + forces[index].x) * .65));
    body.vy = Math.max(-16, Math.min(16, (body.vy + forces[index].y) * .65));
    body.x += body.vx;
    body.y += body.vy;
    speed = Math.max(speed, Math.hypot(body.vx, body.vy));
  });
  return { speed, overlap };
}
