// === www/js/editor2d/tools/lot-tool.js ===
/**
 * Polígono del lote. Cada toque añade un vértice; doble toque (o tocar el
 * primer vértice) cierra el polígono. No valida aquí: `validateSite` bloquea
 * la fase si hay errores.
 */
import { ToolBase } from './tool-base.js';
import { dist } from '../../geometry/vec2.js';

const CLOSE_RADIUS_PX = 14;

export class LotTool extends ToolBase {
  points = [];
  hover = null;

  activate() {
    super.activate();
    this.points = [];
    this.hover = null;
    this.setHud('Lote: toca para añadir vértices · doble toque para cerrar');
  }

  deactivate() {
    super.deactivate();
    this.points = [];
    this.hover = null;
  }

  onPointerDown(world) {
    const p = this.snapCoord(world);
    if (this.points.length >= 3 && this.tryClose(p)) return;
    this.points.push(p);
    this.setHud(`Lote: ${this.points.length} vértices · doble toque para cerrar`);
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

  tryClose(p) {
    const first = this.points[0];
    if (dist(first, p) * this.view.scale < CLOSE_RADIUS_PX) {
      this.finish();
      return true;
    }
    return false;
  }

  finish() {
    if (this.points.length < 3) return;
    const points = this.points.slice();
    this.replaceProject((proj) => {
      proj.site.lot = points;
    }, 'lot');
    this.points = [];
    this.hover = null;
    this.setHud('Lote definido');
  }

  renderOverlay(ctx, view) {
    if (this.points.length === 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const pts = this.points.map((p) => view.worldToScreen(p));
    ctx.strokeStyle = '#5aa9ff';
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
    if (this.hover) drawHandle(ctx, view.worldToScreen(this.hover), 8);
    ctx.restore();
  }
}

export function drawHandle(ctx, screenPt, r) {
  ctx.beginPath();
  ctx.arc(screenPt.x, screenPt.y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(90,169,255,0.18)';
  ctx.fill();
  ctx.strokeStyle = '#5aa9ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
