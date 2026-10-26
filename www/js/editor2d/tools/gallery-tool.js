// === www/js/editor2d/tools/gallery-tool.js ===
/** Polígono de la galería. Mismo patrón que el lote. */
import { ToolBase } from './tool-base.js';
import { drawHandle } from './lot-tool.js';
import { dist } from '../../geometry/vec2.js';

const CLOSE_RADIUS_PX = 14;

export class GalleryTool extends ToolBase {
  points = [];
  hover = null;

  activate() {
    super.activate();
    this.points = [];
    this.hover = null;
    this.setHud('Galería: toca para añadir vértices · doble toque para cerrar');
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
    const polygon = this.points.slice();
    this.replaceProject((proj) => {
      proj.site.gallery = {
        polygon,
        columns: proj.site.gallery?.columns ?? true,
        covered: proj.site.gallery?.covered ?? true,
      };
    }, 'gallery');
    this.points = [];
    this.hover = null;
    this.setHud('Galería definida');
  }

  renderOverlay(ctx, view) {
    if (this.points.length === 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const pts = this.points.map((p) => view.worldToScreen(p));
    ctx.strokeStyle = '#4ade80';
    ctx.fillStyle = 'rgba(74,222,128,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    if (this.hover) {
      const h = view.worldToScreen(this.hover);
      ctx.lineTo(h.x, h.y);
    }
    ctx.stroke();
    for (const p of pts) drawHandle(ctx, p, 16);
    ctx.restore();
  }
}
