// === www/js/editor2d/tools/wall-tool.js ===
/**
 * Polilínea de muros interiores. Cada tramo se inserta con `insertWall`, que
 * une nodos cercanos, divide aristas existentes en cruces y fusiona tramos
 * colineales. El comando reemplaza `nodes` y `walls` del nivel de forma
 * atómica.
 */
import { ToolBase } from './tool-base.js';
import { drawHandle } from './lot-tool.js';
import { insertWall } from '../../geometry/graph.js';

export class WallTool extends ToolBase {
  points = [];
  lastPoint = null;
  cursor = null;

  activate() {
    super.activate();
    this.points = [];
    this.lastPoint = null;
    this.cursor = null;
    this.setHud('Muro interior: toca para trazar tramos · doble toque para terminar');
  }

  deactivate() {
    super.deactivate();
    this.points = [];
    this.lastPoint = null;
    this.cursor = null;
  }

  onPointerDown(world) {
    const point = this.snapCoord(world);
    if (this.lastPoint) this.insertSegment(this.lastPoint, point);
    this.lastPoint = point;
    this.points.push(point);
  }

  onPointerMove(world) {
    this.cursor = this.snapCoord(world);
    this.view.invalidate();
  }

  onDoubleTap() { this.finish(); }

  onCancel() {
    this.points = [];
    this.lastPoint = null;
    this.cursor = null;
    this.view.invalidate();
  }

  finish() {
    this.points = [];
    this.lastPoint = null;
    this.cursor = null;
    this.setHud('Tramo terminado');
  }

  insertSegment(a, b) {
    const level = this.getLevel();
    const levelId = level.id;
    const settings = this.store.project.settings;
    const options = {
      kind: 'interior',
      thickness: settings.wallThickness.interior,
      height: settings.wallHeight,
    };
    const inputGraph = { nodes: level.nodes, walls: level.walls };
    let result;
    try {
      result = insertWall(inputGraph, a, b, options);
    } catch (err) {
      this.setHud(`No se pudo añadir el muro: ${err.message}`);
      return;
    }
    const after = { nodes: result.graph.nodes, walls: result.graph.walls };
    this.replaceLevel(levelId, (lvl) => {
      lvl.nodes = structuredClone(after.nodes);
      lvl.walls = structuredClone(after.walls);
    }, 'wall-add');
  }

  renderOverlay(ctx, view) {
    if (!this.lastPoint) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const from = view.worldToScreen(this.lastPoint);
    if (this.cursor) {
      const to = view.worldToScreen(this.cursor);
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    for (const p of this.points) drawHandle(ctx, view.worldToScreen(p), 14);
    ctx.restore();
  }
}
