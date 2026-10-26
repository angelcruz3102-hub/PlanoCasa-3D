// === www/js/editor2d/snapping.js ===
/**
 * Snap jerárquico: nodo → punto medio → proyección sobre arista → ortogonal
 * respecto a `lastPoint` → ángulo 15° → rejilla. Devuelve el punto ajustado,
 * el tipo activo y las guías a dibujar. El radio se expresa en píxeles de
 * pantalla y se convierte a metros con `12 / view.scale` para que la sensación
 * táctil sea constante al hacer zoom.
 */
import { EPS } from '../core/constants.js';
import { closestPointOnSegment, dist } from '../geometry/vec2.js';

const SCREEN_RADIUS = 12;

export function computeSnap(worldPt, ctx) {
  const {
    level,
    view,
    snaps = {},
    lastPoint = null,
    excludeNodeIds = new Set(),
  } = ctx;

  const radius = SCREEN_RADIUS / (view?.scale ?? 50);
  const guides = [];

  if (level) {
    if (snaps.node) {
      const hit = nearestNode(level, worldPt, radius, excludeNodeIds);
      if (hit) {
        guides.push({ type: 'point', at: { ...hit.point }, color: '#22d3ee' });
        return { point: { ...hit.point }, snapType: 'node', guides };
      }
    }
    if (snaps.midpoint) {
      const hit = nearestMidpoint(level, worldPt, radius);
      if (hit) {
        guides.push({ type: 'point', at: { ...hit.point }, color: '#f472b6' });
        return { point: { ...hit.point }, snapType: 'midpoint', guides };
      }
    }
    if (snaps.edge) {
      const hit = nearestEdgeProjection(level, worldPt, radius);
      if (hit) {
        guides.push({ type: 'point', at: { ...hit.point }, color: '#a78bfa' });
        return { point: { ...hit.point }, snapType: 'edge', guides };
      }
    }
  }

  if (snaps.ortho && lastPoint) {
    const snapped = orthoSnap(worldPt, lastPoint, radius);
    if (snapped) {
      guides.push({
        type: 'line',
        from: { ...lastPoint },
        to: { ...snapped },
        color: 'rgba(90,169,255,0.55)',
      });
      return { point: snapped, snapType: 'ortho', guides };
    }
  }

  if (snaps.angle15 && lastPoint) {
    const snapped = angleSnap(worldPt, lastPoint, radius, 15);
    if (snapped) {
      guides.push({
        type: 'line',
        from: { ...lastPoint },
        to: { ...snapped },
        color: 'rgba(90,169,255,0.35)',
      });
      return { point: snapped, snapType: 'angle15', guides };
    }
  }

  if (snaps.grid) {
    const step = ctx.gridStep ?? 0.10;
    const point = {
      x: Math.round(worldPt.x / step) * step,
      y: Math.round(worldPt.y / step) * step,
    };
    return { point, snapType: 'grid', guides };
  }

  return { point: { ...worldPt }, snapType: 'none', guides };
}

function nearestNode(level, pt, radius, exclude) {
  let best = null;
  let bestDist = radius;
  for (const node of Object.values(level.nodes ?? {})) {
    if (exclude?.has(node.id)) continue;
    const d = dist(node, pt);
    if (d < bestDist) {
      bestDist = d;
      best = { id: node.id, point: { x: node.x, y: node.y } };
    }
  }
  return best;
}

function nearestMidpoint(level, pt, radius) {
  let best = null;
  let bestDist = radius;
  for (const wall of Object.values(level.walls ?? {})) {
    const a = level.nodes[wall.a];
    const b = level.nodes[wall.b];
    if (!a || !b) continue;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = dist(mid, pt);
    if (d < bestDist) {
      bestDist = d;
      best = { wallId: wall.id, point: mid };
    }
  }
  return best;
}

function nearestEdgeProjection(level, pt, radius) {
  let best = null;
  let bestDist = radius;
  for (const wall of Object.values(level.walls ?? {})) {
    const a = level.nodes[wall.a];
    const b = level.nodes[wall.b];
    if (!a || !b) continue;
    const { point } = closestPointOnSegment(pt, a, b);
    const d = dist(point, pt);
    if (d < bestDist) {
      bestDist = d;
      best = { wallId: wall.id, point };
    }
  }
  return best;
}

function orthoSnap(pt, ref, radius) {
  const dx = pt.x - ref.x;
  const dy = pt.y - ref.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < radius && ay < radius) return null;
  if (ax >= ay) return { x: pt.x, y: ref.y };
  return { x: ref.x, y: pt.y };
}

function angleSnap(pt, ref, radius, stepDeg) {
  const dx = pt.x - ref.x;
  const dy = pt.y - ref.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  const ang = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  const delta = Math.abs(ang - snapped);
  if (delta > (3 * Math.PI) / 180) return null;
  return { x: ref.x + Math.cos(snapped) * len, y: ref.y + Math.sin(snapped) * len };
}
