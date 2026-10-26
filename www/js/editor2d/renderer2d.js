// === www/js/editor2d/renderer2d.js ===
/**
 * Renderer 2D por capas. Cachea Path2D/faces por `(levelId, rev)` para no
 * reconstruir muros ni aberturas en cada frame. Los textos y manijas se
 * dibujan en espacio de pantalla para que no se escalen con el zoom.
 *
 * Orden de capas (fondo → frente):
 *   fondo → terreno/lote → calle/acera → galería → nivel fantasma → ambientes
 *   → rejilla → muros → aberturas → escaleras → cotas → selección → guías
 */
import { computeWallFootprints } from '../geometry/joins.js';
import { detectFaces } from '../geometry/faces.js';

const ROOM_FILL = {
  sala: 'rgba(90,169,255,0.14)',
  cocina: 'rgba(251,146,60,0.14)',
  bano: 'rgba(56,189,248,0.14)',
  habitacion: 'rgba(168,85,247,0.14)',
  pasillo: 'rgba(148,163,184,0.14)',
  escalera: 'rgba(34,197,94,0.14)',
  otro: 'rgba(148,163,184,0.10)',
};

export class Renderer2D {
  #cache = new Map();

  render(ctx, view, store, tool) {
    const { project, ui } = store;
    const level = store.getActiveLevel();
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, view.width, view.height);

    ctx.save();
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale,
      dpr * view.panX, dpr * view.panY);

    this.#drawLot(ctx, project);
    this.#drawStreet(ctx, project);
    this.#drawGallery(ctx, project);
    this.#drawGhostLevel(ctx, project, ui.activeLevelId);
    this.#drawRooms(ctx, level);
    this.#drawGrid(ctx, view, project.settings.gridStep);
    this.#drawWalls(ctx, level, view);
    this.#drawOpenings(ctx, level, view);
    this.#drawStairs(ctx, project, level);

    ctx.restore();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#drawDimensions(ctx, view, level);
    this.#drawSnapGuides(ctx, view, ui.snapGuides);
    if (ui.aimMode && ui.lastPointer) {
      this.#drawReticle(ctx, ui.lastPointer.reticle);
    }
    if (tool?.renderOverlay) tool.renderOverlay(ctx, view);
  }

  #cacheFor(level) {
    const key = `${level.id}:${level.rev}`;
    let entry = this.#cache.get(key);
    if (entry) return entry;
    entry = {
      wallFootprints: computeWallFootprints(level),
      faces: detectFaces(level),
    };
    this.#cache.set(key, entry);
    if (this.#cache.size > 8) {
      const k = this.#cache.keys().next().value;
      this.#cache.delete(k);
    }
    return entry;
  }

    #drawGrid(ctx, view, step) {
    const x0 = Math.floor(view.screenToWorld({ x: 0, y: 0 }).x / step) * step;
    const y0 = Math.floor(view.screenToWorld({ x: 0, y: 0 }).y / step) * step;
    const x1 = view.screenToWorld({ x: view.width, y: view.height }).x;
    const y1 = view.screenToWorld({ x: view.width, y: view.height }).y;
    // Aumentado de 0.10 a 0.25 para mejor visibilidad
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1 / view.scale;
    ctx.beginPath();
    for (let x = x0; x <= x1 + step; x += step) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1 + step; y += step) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
  }

  #drawLot(ctx, project) {
    const lot = project.site?.lot;
    if (!lot || lot.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(lot[0].x, lot[0].y);
    for (let i = 1; i < lot.length; i += 1) ctx.lineTo(lot[i].x, lot[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  #drawStreet(ctx, project) {
    const street = project.site?.street;
    if (!street || street.polyline.length < 2) return;
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.lineWidth = street.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(street.polyline[0].x, street.polyline[0].y);
    for (let i = 1; i < street.polyline.length; i += 1) {
      ctx.lineTo(street.polyline[i].x, street.polyline[i].y);
    }
    ctx.stroke();
  }

  #drawGallery(ctx, project) {
    const gallery = project.site?.gallery;
    if (!gallery || gallery.polygon.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(gallery.polygon[0].x, gallery.polygon[0].y);
    for (let i = 1; i < gallery.polygon.length; i += 1) {
      ctx.lineTo(gallery.polygon[i].x, gallery.polygon[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(74,222,128,0.10)';
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  #drawGhostLevel(ctx, project, activeLevelId) {
    if (project.levels.length < 2) return;
    const ghost = project.levels.find((l) => l.id !== activeLevelId);
    if (!ghost || ghost.perimeterLoop.length < 3) return;
    const loop = ghost.perimeterLoop.map((id) => ghost.nodes[id]).filter(Boolean);
    if (loop.length < 3) return;
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2 / ctx.getTransform().a;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(loop[0].x, loop[0].y);
    for (let i = 1; i < loop.length; i += 1) ctx.lineTo(loop[i].x, loop[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  #drawRooms(ctx, level) {
    const { faces } = this.#cacheFor(level);
    for (const face of faces) {
      const pts = face.points;
      if (pts.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      const label = level.labels.find((l) => pointInPolygonQuick(l, pts));
      const type = label?.type ?? 'otro';
      ctx.fillStyle = ROOM_FILL[type] ?? ROOM_FILL.otro;
      ctx.fill();
    }
  }

  #drawWalls(ctx, level, view) {
    const { wallFootprints } = this.#cacheFor(level);
    for (const wall of Object.values(level.walls)) {
      const fp = wallFootprints[wall.id];
      if (!fp) continue;
      ctx.beginPath();
      ctx.moveTo(fp.start.left.x, fp.start.left.y);
      ctx.lineTo(fp.end.left.x, fp.end.left.y);
      ctx.lineTo(fp.end.right.x, fp.end.right.y);
      ctx.lineTo(fp.start.right.x, fp.start.right.y);
      ctx.closePath();
      ctx.fillStyle = wall.kind === 'exterior' ? '#e2e8f0' : '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1 / view.scale;
      ctx.stroke();
    }
  }

  #drawOpenings(ctx, level, view) {
    for (const op of Object.values(level.openings)) {
      const wall = level.walls[op.wallId];
      if (!wall) continue;
      const a = level.nodes[wall.a];
      const b = level.nodes[wall.b];
      if (!a || !b) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-6) continue;
      const dirX = (b.x - a.x) / len;
      const dirY = (b.y - a.y) / len;
      const nx = -dirY;
      const ny = dirX;
      const s0 = op.s - op.width / 2;
      const s1 = op.s + op.width / 2;
      const p0 = { x: a.x + dirX * s0, y: a.y + dirY * s0 };
      const p1 = { x: a.x + dirX * s1, y: a.y + dirY * s1 };
      const halfT = wall.thickness / 2;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1 / view.scale;
      if (op.type === 'door') {
        ctx.beginPath();
        ctx.moveTo(p0.x + nx * halfT, p0.y + ny * halfT);
        ctx.lineTo(p1.x + nx * halfT, p1.y + ny * halfT);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, op.width, -Math.atan2(dirY, dirX), 0, false);
        ctx.stroke();
      } else {
        for (const k of [-halfT, 0, halfT]) {
          ctx.beginPath();
          ctx.moveTo(p0.x + nx * k, p0.y + ny * k);
          ctx.lineTo(p1.x + nx * k, p1.y + ny * k);
          ctx.stroke();
        }
      }
    }
  }

  #drawStairs(ctx, project, level) {
    for (const stair of project.stairs) {
      const belongsToActive = stair.fromLevelId === level.id || stair.toLevelId === level.id;
      if (!belongsToActive) continue;
      const hole = stair.holePolygon ?? [];
      if (hole.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(hole[0].x, hole[0].y);
      for (let i = 1; i < hole.length; i += 1) ctx.lineTo(hole[i].x, hole[i].y);
      ctx.closePath();
      ctx.strokeStyle = '#22c55e';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      const from = stair.fromLevelId === level.id ? '↑' : '↓';
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(from, stair.x, stair.y);
    }
  }

  #drawDimensions(ctx, view, level) {
    if (level.perimeterLoop.length < 2) return;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const wall of Object.values(level.walls)) {
      const a = level.nodes[wall.a];
      const b = level.nodes[wall.b];
      if (!a || !b) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const screen = view.worldToScreen(mid);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      ctx.fillText(`${len.toFixed(2)} m`, screen.x, screen.y - 8);
    }
  }

  #drawSnapGuides(ctx, view, guides) {
    if (!guides || guides.length === 0) return;
    for (const g of guides) {
      if (g.type === 'point') {
        const p = view.worldToScreen(g.at);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = g.color ?? '#22d3ee';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (g.type === 'line') {
        const a = view.worldToScreen(g.from);
        const b = view.worldToScreen(g.to);
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = g.color ?? 'rgba(90,169,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  #drawReticle(ctx, reticle) {
    if (!reticle) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(90,169,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(reticle.x, reticle.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(reticle.x - 8, reticle.y);
    ctx.lineTo(reticle.x + 8, reticle.y);
    ctx.moveTo(reticle.x, reticle.y - 8);
    ctx.lineTo(reticle.x, reticle.y + 8);
    ctx.stroke();
    ctx.restore();
  }
}

function pointInPolygonQuick(pt, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const hit = (yi > pt.y) !== (yj > pt.y)
      && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}
