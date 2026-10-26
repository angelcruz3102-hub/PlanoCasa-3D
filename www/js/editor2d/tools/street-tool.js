// === www/js/editor2d/tools/street-tool.js ===
/** Polilínea de la calle. Doble toque cierra el trazado (≥2 puntos). */
import { ToolBase } from './tool-base.js';
import { drawHandle } from './lot-tool.js';

export class StreetTool extends ToolBase {
  points = [];
  hover = null;

  activate() {
    super.activate();
    this.points = [];
    this.hover = null;
    this.setHud('Calle: toca para añadir puntos · doble toque para terminar');
  }

  deactivate() {
    super.deactivate();
    this.points = [];
    this.hover = null;
  }

  onPointerDown(world) {
    this.points.push(this.snapCoord(world));
    this.setHud(`Calle: ${this.points.length} puntos`);
  }

  onPointerMove(world) {
    this.hover = this.snapCoord(world);
    this.view.invalidate();
  }

  onDoubleTap() {
    if (this.points.length >= 2) this.finish();
  }

  onCancel() {
    this.points = [];
    this.hover = null;
    this.view.invalidate();
  }

  finish() {
    if (this.points.length < 2) return;
    const polyline = this.points.slice();
    this.replaceProject((proj) => {
      const width = proj.site.street?.width ?? 6.0;
      const sidewalk = proj.site.street?.sidewalk ?? { enabled: true, width: 1.2 };
      proj.site.street = { polyline, width, sidewalk };
    }, 'street');
    this.points = [];
    this.hover = null;
    this.setHud('Calle definida');
  }

  renderOverlay(ctx, view) {
    if (this.points.length === 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const pts = this.points.map((p) => view.worldToScreen(p));
    ctx.strokeStyle = '#fbbf24';
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
