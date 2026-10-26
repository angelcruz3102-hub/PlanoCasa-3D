// === www/js/editor2d/tools/perimeter-tool.js ===
/**
 * Polígono del perímetro estructural. Al cerrar genera nodos y muros
 * `exterior` en L1 y fija `perimeterLoop`.
 */
import { ToolBase } from './tool-base.js';
import { drawHandle } from './lot-tool.js';
import { dist } from '../../geometry/vec2.js';
import { createId } from '../../core/schema.js';

const CLOSE_RADIUS_PX = 14;

export class PerimeterTool extends ToolBase {
  points = [];
  hover = null;

  activate() {
    super.activate();
    this.points = [];
    this.hover = null;
    this.setHud('Perímetro: toca para añadir vértices · doble toque para cerrar');
  }

  deactivate() {
    super.deactivate();
    this.points = [];
    this.hover = null;
  }

  onPointerDown(world) {
    const p = this.snapCoord(world);
    if (this.points.length >= 3 && dist(this.points[0], p) * this.view.scale < CLOSE_RADIUS_PX) {
      this.finish();
      return;
    }
    this.points.push(p);
  }

  onPointerMove(world) {
    this.hover = this.snapCoord(world);
    this.view.invalidate();
  }

  onDoubleTap() {
    if (this.points.length >= 3) this.finish();
  }

  onCancel() {
    this.points = [];
    this.hover = null;
    this.view.invalidate();
  }

  finish() {
    if (this.points.length < 3) return;
    const points = this.points.slice();
    const levelId = this.store.project.levels[0].id;
    const settings = this.store.project.settings;
    this.replaceLevel(levelId, (lvl) => {
      const oldLoop = new Set(lvl.perimeterLoop);
      for (const w of Object.values(lvl.walls)) {
        if (oldLoop.has(w.a) && oldLoop.has(w.b)) delete lvl.walls[w.id];
      }
      for (const id of oldLoop) delete lvl.nodes[id];
      lvl.perimeterLoop = [];
      const ids = points.map((pt) => {
        const id = createId('node');
        lvl.nodes[id] = { id, x: pt.x, y: pt.y };
        return id;
      });
      for (let i = 0; i < ids.length; i += 1) {
        const wid = createId('wall');
        lvl.walls[wid] = {
          id: wid,
          a: ids[i],
          b: ids[(i + 1) % ids.length],
          kind: 'exterior',
          thickness: settings.wallThickness.exterior,
          height: settings.wallHeight,
        };
      }
      lvl.perimeterLoop = ids;
    }, 'perimeter');
    this.points = [];
    this.hover = null;
    this.setHud('Perímetro definido');
  }

  renderOverlay(ctx, view) {
    if (this.points.length === 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const pts = this.points.map((p) => view.worldToScreen(p));
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    if (this.hover) {
      const h = view.worldToScreen(this.hover);
      ctx.lineTo(h.x, h.y);
    }
    ctx.stroke();
    for (const p of pts) drawHandle(ctx, p, 18);
    ctx.restore();
  }
}
