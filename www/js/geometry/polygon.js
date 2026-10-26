// === www/js/geometry/polygon.js ===
/** Polígonos simples: área con signo, orientación, punto-en-polígono, simplicidad. */
import { EPS } from '../core/constants.js';
import { cross, sub } from './vec2.js';

export function area2(points) {
  let s = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

export function area(points) {
  return Math.abs(area2(points)) / 2;
}

export function ensureCounterClockwise(points) {
  return area2(points) < 0 ? [...points].reverse() : points.map((p) => ({ ...p }));
}

export function ensureClockwise(points) {
  return area2(points) > 0 ? [...points].reverse() : points.map((p) => ({ ...p }));
}

export function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = yi > p.y !== yj > p.y
      && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a, b, c, d) {
  const ab = sub(b, a);
  const cd = sub(d, c);
  const ac = sub(c, a);
  const den = cross(ab, cd);
  if (Math.abs(den) < EPS) return false;
  const t = cross(ac, cd) / den;
  const u = cross(ac, ab) / den;
  return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS;
}

export function polygonSelfIntersects(points) {
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      const c = points[j];
      const d = points[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export function isSimplePolygon(points) {
  return points.length >= 3 && !polygonSelfIntersects(points) && area(points) > EPS;
}

export function distanceToPolygonEdges(p, polygon) {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
    const dx = p.x - (a.x + ab.x * t);
    const dy = p.y - (a.y + ab.y * t);
    min = Math.min(min, Math.hypot(dx, dy));
  }
  return min;
}

export function removeCollinear(points, tol = 1e-4) {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const ab = sub(curr, prev);
    const bc = sub(next, curr);
    if (Math.abs(cross(ab, bc)) > tol) out.push({ ...curr });
  }
  return out.length >= 3 ? out : points.map((p) => ({ ...p }));
}
