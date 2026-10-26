// === www/js/editor2d/tools/select-tool.js ===
/**
 * Selección, arrastre de nodos y borrado. El arrastre muta el nivel en vivo
 * (sin comando) para que el feedback sea inmediato; al soltar se revierte el
 * estado original y se emite un único comando reversible. Si el gesto se
 * cancela (pellizco, pointercancel), `onCancel` restaura las posiciones.
 */
import { ToolBase } from './tool-base.js';
import { drawHandle } from './lot-tool.js';
import { dist } from '../../geometry/vec2.js';

const HANDLE_RADIUS_PX = 22;

export class SelectTool extends ToolBase {
  dragging = null;
  dragOriginal = null;

  activate() {
    super.activate();
    this.setHud('Selecciona un elemento; arrastra un vértice para moverlo');
  }

  deactivate() {
    super.deactivate();
    this.dragging = null;
    this.dragOriginal = null;
    if (this.store.ui.selection) {
      this.store.ui.selection = null;
      this.view.invalidate();
    }
  }

  onPointerDown(world) {
    const level = this.getLevel();
    const levelId = level.id;
    const radius = HANDLE_RADIUS_PX / this.view.scale;

    let bestNode = null;
    let bestDist = radius;
    for (const node of Object.values(level.nodes)) {
      const d = dist(node, world);
      if (d < bestDist) { bestDist = d; bestNode = node; }
    }

    if (bestNode) {
      this.store.ui.selection = { kind: 'node', levelId, id: bestNode.id };
      this.dragOriginal = { x: bestNode.x, y: bestNode.y };
      this.dragging = { kind: 'node', levelId, id: bestNode.id };
      this.view.invalidate();
      return;
    }

    const opening = this.findOpening(level, world, radius);
    if (opening) {
      this.store.ui.selection = { kind: 'opening', levelId, id: opening.id };
      this.dragging = { kind: 'opening', levelId, id: opening.id };
      this.dragOriginal = { s: opening.s };
      this.view.invalidate();
      return;
    }
    const label = this.findLabel(level, world, radius);
    if (label) {
      this.store.ui.selection = { kind: 'label', levelId, id: label.id };
      this.dragging = { kind: 'label', levelId, id: label.id };
      this.dragOriginal = { x: label.x, y: label.y };
      this.view.invalidate();
      return;
    }

    this.store.ui.selection = null;
    this.view.invalidate();
  }

  onPointerMove(world) {
    if (!this.dragging) return;
    const point = this.snapCoord(world);
    const { kind, levelId, id } = this.dragging;
    const level = this.getLevelById(levelId);
    if (!level) return;

    if (kind === 'node') {
      const node = level.nodes[id];
      if (!node) return;
      node.x = point.x;
      node.y = point.y;
      level.rev += 1;
    } else if (kind === 'opening') {
      const op = level.openings[id];
      if (!op) return;
      const wall = level.walls[op.wallId];
      if (!wall) return;
      const a = level.nodes[wall.a];
      const b = level.nodes[wall.b];
      if (!a || !b) return;
      const len = dist(a, b);
      const dirX = (b.x - a.x) / len;
      const dirY = (b.y - a.y) / len;
      const t = (point.x - a.x) * dirX + (point.y - a.y) * dirY;
      op.s = Math.max(op.width / 2, Math.min(len - op.width / 2, t));
      level.rev += 1;
    } else if (kind === 'label') {
      const label = level.labels.find((l) => l.id === id);
      if (!label) return;
      label.x = point.x;
      label.y = point.y;
      level.rev += 1;
    }
    this.view.invalidate();
  }

  onPointerUp() {
    if (!this.dragging) return;
    const { kind, levelId, id } = this.dragging;
    const level = this.getLevelById(levelId);
    const original = this.dragOriginal;
    this.dragging = null;
    this.dragOriginal = null;
    if (!level || !original) return;

    if (kind === 'node') {
      const node = level.nodes[id];
      if (!node) return;
      const after = { x: node.x, y: node.y };
      node.x = original.x;
      node.y = original.y;
      level.rev += 1;
      this.replaceLevel(levelId, (lvl) => {
        const n = lvl.nodes[id];
        if (n) { n.x = after.x; n.y = after.y; }
      }, 'node-move');
    } else if (kind === 'opening') {
      const op = level.openings[id];
      if (!op) return;
      const after = { s: op.s };
      op.s = original.s;
      level.rev += 1;
      this.replaceLevel(levelId, (lvl) => {
        const o = lvl.openings[id];
        if (o) o.s = after.s;
      }, 'opening-move');
    } else if (kind === 'label') {
      const label = level.labels.find((l) => l.id === id);
      if (!label) return;
      const after = { x: label.x, y: label.y };
      label.x = original.x;
      label.y = original.y;
      level.rev += 1;
      this.replaceLevel(levelId, (lvl) => {
        const l = lvl.labels.find((x) => x.id === id);
        if (l) { l.x = after.x; l.y = after.y; }
      }, 'label-move');
    }
    this.view.invalidate();
  }

  onCancel() {
    if (this.dragging && this.dragOriginal) {
      const { levelId, kind, id } = this.dragging;
      const level = this.getLevelById(levelId);
      if (level) {
        if (kind === 'node' && level.nodes[id]) {
          level.nodes[id].x = this.dragOriginal.x;
          level.nodes[id].y = this.dragOriginal.y;
        } else if (kind === 'opening' && level.openings[id]) {
          level.openings[id].s = this.dragOriginal.s;
        } else if (kind === 'label') {
          const l = level.labels.find((x) => x.id === id);
          if (l) { l.x = this.dragOriginal.x; l.y = this.dragOriginal.y; }
        }
        level.rev += 1;
      }
    }
    this.dragging = null;
    this.dragOriginal = null;
    this.view.invalidate();
  }

  findOpening(level, world, radius) {
    let best = null;
    let bestDist = radius;
    for (const op of Object.values(level.openings)) {
      const wall = level.walls[op.wallId];
      if (!wall) continue;
      const a = level.nodes[wall.a];
      const b = level.nodes[wall.b];
      if (!a || !b) continue;
      const len = dist(a, b);
      const dirX = (b.x - a.x) / len;
      const dirY = (b.y - a.y) / len;
      const cx = a.x + dirX * op.s;
      const cy = a.y + dirY * op.s;
      const d = Math.hypot(cx - world.x, cy - world.y);
      if (d < bestDist) { bestDist = d; best = op; }
    }
    return best;
  }

  findLabel(level, world, radius) {
    let best = null;
    let bestDist = radius;
    for (const lab of level.labels) {
      const d = Math.hypot(lab.x - world.x, lab.y - world.y);
      if (d < bestDist) { bestDist = d; best = lab; }
    }
    return best;
  }

  renderOverlay(ctx, view) {
    const selection = this.store.ui.selection;
    if (!selection) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const level = this.getLevelById(selection.levelId);
    if (!level) { ctx.restore(); return; }

    if (selection.kind === 'node') {
      const node = level.nodes[selection.id];
      if (node) drawHandle(ctx, view.worldToScreen(node), HANDLE_RADIUS_PX);
    } else if (selection.kind === 'opening') {
      const op = level.openings[selection.id];
      if (op) {
        const wall = level.walls[op.wallId];
        if (wall) {
          const a = level.nodes[wall.a];
          const b = level.nodes[wall.b];
          if (a && b) {
            const len = dist(a, b);
            const dirX = (b.x - a.x) / len;
            const dirY = (b.y - a.y) / len;
            const cx = a.x + dirX * op.s;
            const cy = a.y + dirY * op.s;
            const screen = view.worldToScreen({ x: cx, y: cy });
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, HANDLE_RADIUS_PX, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    } else if (selection.kind === 'label') {
      const label = level.labels.find((l) => l.id === selection.id);
      if (label) {
        const screen = view.worldToScreen(label);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.strokeRect(screen.x - 12, screen.y - 12, 24, 24);
      }
    }
    ctx.restore();
  }
}
