// 保存データと分離した座標を、構造変更時に再計算する。
import { shallowRef, ref, watch, onBeforeUnmount } from 'vue';
import { stepPhysics } from '../utils/physics.js';

// シートを返す関数を受け取り、座標、サイズ更新、停止・再開を返す。
export function usePhysicsSimulation(readSheet) {
  const positions = shallowRef(Object.create(null));
  const isRunning = ref(false);
  const dimensions = new Map();
  let bodies = [];
  let edges = [];
  let frame;
  let stableFrames = 0;
  let ticks = 0;
  let isPaused = false;

  // 現在の座標を描画用に公開する。
  function publish() {
    positions.value = Object.fromEntries(bodies.map(body => [body.id, { x: body.x, y: body.y,
      width: body.width, height: body.height }]));
  }

  // 計算を停止してアニメーション予約を解除する。
  function stop() {
    cancelAnimationFrame(frame);
    isRunning.value = false;
  }

  // 一定速度以下への収束まで計算し、長時間の暴走時も停止する。
  function tick() {
    if (isPaused) return;
    const result = stepPhysics(bodies, edges, readSheet().groups);
    stableFrames = result.speed < .08 && result.overlap < 1 ? stableFrames + 1 : 0;
    ticks++;
    publish();
    if (stableFrames >= 18 || ticks >= 1800) { stop(); return; }
    frame = requestAnimationFrame(tick);
  }

  // 現在位置を保ちながら、追加ノードと接続を同期して再計算を始める。
  function restart() {
    stop();
    const sheet = readSheet();
    const previous = new Map(bodies.map(body => [body.id, body]));
    bodies = sheet.nodes.map((node, index) => {
      const parent = previous.get(node.parent) || { x: 0, y: 0 };
      const angle = (index - 1) * 2.399963;
      const prior = previous.get(node.id);
      return { id: node.id, isRoot: node.parent === null,
        x: prior?.x ?? parent.x + Math.cos(angle) * 240,
        y: prior?.y ?? parent.y + Math.sin(angle) * 240,
        vx: 0, vy: 0, width: dimensions.get(node.id)?.width || (node.parent === null ? 240 : 192),
        height: dimensions.get(node.id)?.height || (node.parent === null ? 72 : 56) };
    });
    bodies.forEach(body => { if (body.isRoot) { body.x = 0; body.y = 0; } });
    edges = sheet.nodes.filter(node => node.parent !== null).map(node => ({ a: node.parent, b: node.id }))
      .concat(sheet.links.map(link => ({ ...link, isIndirect: true })));
    stableFrames = 0;
    ticks = 0;
    publish();
    if (isPaused) return;
    isRunning.value = bodies.length > 1;
    if (isRunning.value) frame = requestAnimationFrame(tick);
  }

  // 実測したノード寸法を受け取り、重なり判定へ反映する。
  function resize(id, size) {
    const previous = dimensions.get(id);
    if (!size.width || !size.height || (previous?.width === size.width && previous?.height === size.height)) return;
    dimensions.set(id, size);
    restart();
  }

  // 編集中や長押し中はノードを静止させ、終了後に再開する。
  function pause(value) {
    isPaused = value;
    if (value) stop();
    else restart();
  }

  watch(() => {
    const sheet = readSheet();
    return JSON.stringify([sheet.nodes.map(node => [node.id, node.parent]), sheet.links.map(link => [link.id, link.a, link.b]), sheet.groups.map(group => group.members)]);
  }, restart, { immediate: true });
  onBeforeUnmount(stop);
  return { positions, isRunning, resize, pause, restart, stop };
}
